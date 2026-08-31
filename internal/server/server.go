package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"pi-chat-gateway/internal/db"
	"pi-chat-gateway/internal/llm"
	"pi-chat-gateway/internal/voice"
	"pi-chat-gateway/web"
)

// Server is the HTTP API server.
type Server struct {
	store db.Store
	llm   *llm.Client
	mux   *http.ServeMux
}

// New creates a Server with all routes registered.
func New(store db.Store, llmClient *llm.Client) *Server {
	s := &Server{
		store: store,
		llm:   llmClient,
		mux:   http.NewServeMux(),
	}

	s.mux.HandleFunc("GET /api/providers", s.handleListProviders)
	s.mux.HandleFunc("POST /api/providers", s.handleSaveProvider)
	s.mux.HandleFunc("PUT /api/providers/{id}", s.handleSaveProvider)
	s.mux.HandleFunc("DELETE /api/providers/{id}", s.handleDeleteProvider)
	s.mux.HandleFunc("GET /api/models", s.handleListModels)
	s.mux.HandleFunc("GET /api/system-prompts", s.handleListSystemPrompts)
	s.mux.HandleFunc("POST /api/system-prompts", s.handleSaveSystemPrompt)
	s.mux.HandleFunc("DELETE /api/system-prompts/{id}", s.handleDeleteSystemPrompt)
	s.mux.HandleFunc("GET /api/settings", s.handleGetSettings)
	s.mux.HandleFunc("PUT /api/settings", s.handleSaveSettings)
	s.mux.HandleFunc("GET /api/voice", s.handleGetVoice)
	s.mux.HandleFunc("PUT /api/voice", s.handleSetVoice)
	s.mux.HandleFunc("POST /api/voice/speak", s.handleVoiceSpeak)
	s.mux.HandleFunc("GET /api/conversations", s.handleListConversations)
	s.mux.HandleFunc("DELETE /api/conversations", s.handleClearConversations)
	s.mux.HandleFunc("POST /api/conversations", s.handleCreateConversation)
	s.mux.HandleFunc("GET /api/conversations/{id}", s.handleGetConversation)
	s.mux.HandleFunc("PUT /api/conversations/{id}", s.handleUpdateConversation)
	s.mux.HandleFunc("DELETE /api/conversations/{id}", s.handleDeleteConversation)
	s.mux.HandleFunc("POST /api/chat", s.handleChat)
	s.mux.HandleFunc("POST /api/chat/regenerate", s.handleRegenerate)

	return s
}

// Handler returns the root http.Handler (serves embedded static + API).
func (s *Server) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			s.mux.ServeHTTP(w, r)
			return
		}
		web.ServeStatic(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// clientIDFromRequest extracts the client identifier from the request.
// It checks the X-Client-ID header, the client_id query param, and the client_id cookie.
// Falls back to "default" if none is present.
func clientIDFromRequest(r *http.Request) string {
	if id := strings.TrimSpace(r.Header.Get("X-Client-ID")); id != "" {
		return id
	}
	if id := strings.TrimSpace(r.URL.Query().Get("client_id")); id != "" {
		return id
	}
	if cookie, err := r.Cookie("client_id"); err == nil && strings.TrimSpace(cookie.Value) != "" {
		return strings.TrimSpace(cookie.Value)
	}
	return "default"
}

// --- Providers ---

// maskAPIKey redacts a stored API key for display. It keeps the last 4
// characters so the user can tell which key is configured.
func maskAPIKey(key string) string {
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	if len(key) <= 4 {
		return "••••"
	}
	return "••••••••" + key[len(key)-4:]
}

// isMaskedKey reports whether the submitted key is a masked placeholder
// (i.e. the client is re-submitting an existing key unchanged).
func isMaskedKey(key string) bool {
	key = strings.TrimSpace(key)
	return strings.HasPrefix(key, "••")
}

func (s *Server) handleListProviders(w http.ResponseWriter, r *http.Request) {
	list, err := s.store.ListProviders()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Mask API keys before returning to the client.
	for i := range list {
		list[i].APIKey = maskAPIKey(list[i].APIKey)
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleSaveProvider(w http.ResponseWriter, r *http.Request) {
	var p db.Provider
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&p); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid provider payload: "+err.Error())
		return
	}
	if p.Name == "" || p.BaseURL == "" {
		writeErr(w, http.StatusBadRequest, "name and base_url are required")
		return
	}
	if p.ID == "" {
		p.ID = r.PathValue("id")
	}
	if p.Type == "ollama-online" {
		p.Type = "ollama"
	} else if p.Type == "ollama-local" {
		p.Type = "ollama"
		p.APIKey = ""
	}
	if p.Type != "ollama" && p.Type != "llamacpp" {
		p.Type = "llamacpp"
	}
	// Validate the base URL. Accept bare hostnames (e.g. "Vivid1" or
	// "192.168.1.50:11434") and prepend http://, but reject clearly
	// malformed values.
	base := strings.TrimSpace(p.BaseURL)
	if !strings.HasPrefix(base, "http://") && !strings.HasPrefix(base, "https://") {
		base = "http://" + base
	}
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		writeErr(w, http.StatusBadRequest, "base_url must be a valid URL or hostname (e.g. http://192.168.1.50:11434)")
		return
	}
	p.BaseURL = base
	if p.ID == "" {
		p.ID = db.NewID()
	}

	// If the client submitted a masked key (or no key) for an existing
	// provider, preserve the previously stored key.
	if isMaskedKey(p.APIKey) || p.APIKey == "" {
		if existing, err := s.store.GetProvider(p.ID); err == nil {
			p.APIKey = existing.APIKey
		}
	}

	if err := s.store.SaveProvider(p); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Return the masked key so the client never sees the raw secret.
	p.APIKey = maskAPIKey(p.APIKey)
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleDeleteProvider(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.store.DeleteProvider(id); err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	// Reset any conversations that referenced the deleted provider and
	// clear their model so they don't point at a stale model name.
	convs, err := s.store.ListAllConversations()
	if err == nil {
		for _, cc := range convs {
			if cc.Conversation.Settings.ProviderID == id {
				cc.Conversation.Settings.ProviderID = ""
				cc.Conversation.Settings.Model = ""
				cc.Conversation.UpdatedAt = time.Now().Unix()
				_ = s.store.SaveConversation(cc.ClientID, cc.Conversation)
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- System prompts ---

func (s *Server) handleListSystemPrompts(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	list, err := s.store.ListSystemPrompts(clientID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleSaveSystemPrompt(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	var p db.SystemPrompt
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&p); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid system prompt payload: "+err.Error())
		return
	}
	if p.Name == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	if p.Scope == "" {
		p.Scope = "local"
	}
	if p.Scope != "local" && p.Scope != "global" {
		writeErr(w, http.StatusBadRequest, "scope must be local or global")
		return
	}
	if p.ID == "" {
		p.ID = db.NewID()
	}
	if err := s.store.SaveSystemPrompt(clientID, p); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleDeleteSystemPrompt(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	id := r.PathValue("id")
	if err := s.store.DeleteSystemPrompt(clientID, id); err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	// If the deleted prompt was the default, clear the default.
	settings, err := s.store.GetAppSettings(clientID)
	if err == nil && settings.DefaultSystemPromptID == id {
		settings.DefaultSystemPromptID = ""
		_ = s.store.SaveAppSettings(clientID, settings)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- Settings ---

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	settings, err := s.store.GetAppSettings(clientID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (s *Server) handleSaveSettings(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	var settings db.AppSettings
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&settings); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid settings payload: "+err.Error())
		return
	}
	if err := s.store.SaveAppSettings(clientID, settings); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

// --- Voice ---

// handleGetVoice returns the current global voice setting and speed for this client.
func (s *Server) handleGetVoice(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	settings, err := s.store.GetAppSettings(clientID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"voice":       settings.Voice,
		"voice_speed": voiceSpeed(settings.VoiceSpeed),
		"voice_name":  voiceName(settings.VoiceName),
	})
}

// handleSetVoice toggles the voice setting for this client.
// The request body may contain {"voice": true/false} to set a specific value,
// or be empty to toggle the current value. It may also contain
// {"voice_speed": 1-10} to set the speech speed (1 is normal).
func (s *Server) handleSetVoice(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	settings, err := s.store.GetAppSettings(clientID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req struct {
		Voice      *bool  `json:"voice"`
		VoiceSpeed *int   `json:"voice_speed"`
		VoiceName  string `json:"voice_name"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil && err != io.EOF {
		writeErr(w, http.StatusBadRequest, "invalid voice payload: "+err.Error())
		return
	}

	if req.Voice != nil {
		settings.Voice = *req.Voice
	} else {
		settings.Voice = !settings.Voice
	}

	if req.VoiceSpeed != nil {
		if *req.VoiceSpeed < 1 {
			*req.VoiceSpeed = 1
		}
		if *req.VoiceSpeed > 10 {
			*req.VoiceSpeed = 10
		}
		settings.VoiceSpeed = *req.VoiceSpeed
	}
	if strings.TrimSpace(req.VoiceName) != "" {
		settings.VoiceName = strings.TrimSpace(req.VoiceName)
	}

	if err := s.store.SaveAppSettings(clientID, settings); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"voice":       settings.Voice,
		"voice_speed": settings.VoiceSpeed,
		"voice_name":  voiceName(settings.VoiceName),
	})
}

func voiceName(name string) string {
	if strings.TrimSpace(name) == "" {
		return voice.DefaultVoice
	}
	return strings.TrimSpace(name)
}

func voiceSpeed(speed int) int {
	if speed < 1 || speed > 10 {
		return 3
	}
	return speed
}

// handleVoiceSpeak generates MP3 speech audio on demand for the provided text.
func (s *Server) handleVoiceSpeak(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	var req struct {
		Text      string `json:"text"`
		Speed     *int   `json:"speed"`
		VoiceName string `json:"voice_name"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid payload: "+err.Error())
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		writeErr(w, http.StatusBadRequest, "text is required")
		return
	}

	settings, _ := s.store.GetAppSettings(clientID)
	speed := 3
	if req.Speed != nil && *req.Speed >= 1 && *req.Speed <= 10 {
		speed = *req.Speed
	} else {
		if settings.VoiceSpeed >= 1 && settings.VoiceSpeed <= 10 {
			speed = settings.VoiceSpeed
		}
	}
	selectedVoice := voiceName(req.VoiceName)
	if req.VoiceName == "" {
		selectedVoice = voiceName(settings.VoiceName)
	}

	audioBytes, err := voice.SpeakToBytesWithVoice(text, selectedVoice, speed, false)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "TTS generation failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"audio":      base64.StdEncoding.EncodeToString(audioBytes),
		"audio_mime": "audio/mpeg",
	})
}

// --- Models ---

func (s *Server) handleListModels(w http.ResponseWriter, r *http.Request) {
	providerID := r.URL.Query().Get("provider_id")
	if providerID == "" {
		writeErr(w, http.StatusBadRequest, "provider_id is required")
		return
	}
	p, err := s.store.GetProvider(providerID)
	if err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	models, err := s.llm.ListModels(ctx, p)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, models)
}

// --- Conversations ---

func (s *Server) handleListConversations(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	list, err := s.store.ListConversations(clientID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleClearConversations(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	if err := s.store.ClearConversations(clientID); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleCreateConversation(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	var req struct {
		Title    string      `json:"title"`
		Settings db.Settings `json:"settings"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid payload: "+err.Error())
		return
	}
	now := time.Now().Unix()
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "New Chat"
	}
	if req.Settings.MaxTurns <= 0 {
		req.Settings.MaxTurns = 12
	}
	c := db.Conversation{
		ID:        db.NewID(),
		Title:     title,
		Settings:  req.Settings,
		Messages:  []db.Message{},
		UpdatedAt: now,
	}
	if err := s.store.SaveConversation(clientID, c); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *Server) handleGetConversation(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	id := r.PathValue("id")
	c, err := s.store.GetConversation(clientID, id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *Server) handleUpdateConversation(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	id := r.PathValue("id")
	var c db.Conversation
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&c); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid payload: "+err.Error())
		return
	}
	if c.ID != "" && c.ID != id {
		writeErr(w, http.StatusBadRequest, "id mismatch")
		return
	}
	c.ID = id
	if c.Settings.MaxTurns <= 0 {
		c.Settings.MaxTurns = 12
	}
	if err := s.store.SaveConversation(clientID, c); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *Server) handleDeleteConversation(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	id := r.PathValue("id")
	if err := s.store.DeleteConversation(clientID, id); err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- Chat ---

// isVoiceToggle reports whether the message is a voice on/off command.
// Accepts: "voice", "voice on", "voice off", "voice on/off", "voice toggle".
func isVoiceToggle(msg string) bool {
	lower := strings.ToLower(strings.TrimSpace(msg))
	switch lower {
	case "voice", "voice on", "voice off", "voice on/off", "voice toggle", "voice on off":
		return true
	}
	return false
}

// voiceToggleValue parses the desired voice state from a toggle message.
// Returns the new state and whether the message explicitly requested on/off.
func voiceToggleValue(msg string, current bool) (bool, bool) {
	lower := strings.ToLower(strings.TrimSpace(msg))
	switch lower {
	case "voice on":
		return true, true
	case "voice off":
		return false, true
	default:
		// "voice" or "voice toggle" — flip the current state.
		return !current, false
	}
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	var req struct {
		ConversationID string `json:"conversation_id"`
		UserMessage    string `json:"user_message"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid payload: "+err.Error())
		return
	}
	if req.ConversationID == "" {
		writeErr(w, http.StatusBadRequest, "conversation_id is required")
		return
	}
	msg := strings.TrimSpace(req.UserMessage)
	if msg == "" {
		writeErr(w, http.StatusBadRequest, "user_message is required")
		return
	}

	c, err := s.store.GetConversation(clientID, req.ConversationID)
	if err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}

	// Handle voice toggle commands before sending to the LLM.
	if isVoiceToggle(msg) {
		settings, err := s.store.GetAppSettings(clientID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		newState, _ := voiceToggleValue(msg, settings.Voice)
		settings.Voice = newState
		if err := s.store.SaveAppSettings(clientID, settings); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Append the user message and a system-style assistant reply.
		now := time.Now().Unix()
		c.Messages = append(c.Messages, db.Message{Role: "user", Content: msg, Timestamp: now})
		stateText := "ON"
		if !newState {
			stateText = "OFF"
		}
		reply := "🔊 Voice is now " + stateText + "."
		c.Messages = append(c.Messages, db.Message{Role: "assistant", Content: reply, Timestamp: time.Now().Unix()})
		c.UpdatedAt = time.Now().Unix()
		if err := s.store.SaveConversation(clientID, c); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, c)
		return
	}

	// Resolve provider.
	p, err := s.store.GetProvider(c.Settings.ProviderID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "conversation has no valid provider: "+err.Error())
		return
	}

	// Append the user message.
	now := time.Now().Unix()
	c.Messages = append(c.Messages, db.Message{Role: "user", Content: msg, Timestamp: now})

	// Auto-title on first user message.
	if len(c.Messages) == 1 {
		c.Title = summarizeTitle(msg)
	}

	// Story mode keeps the narrative and the latest prompt while omitting
	// prior user messages from the upstream context.
	history := c.Messages
	if c.Settings.Mode == "story" {
		history = storyContext(c.Messages)
	}

	// Call upstream with context sliding.
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()
	reply, err := s.llm.Chat(ctx, p, c.Settings.Model, c.Settings.SystemPrompt, history, c.Settings.MaxTurns)
	if err != nil {
		// Persist the user message even on failure so it isn't lost.
		c.UpdatedAt = now
		_ = s.store.SaveConversation(clientID, c)
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}

	// DEBUG: print the raw AI response to the console.
	log.Printf("[chat] AI response: %s", reply)

	// Save assistant reply.
	c.Messages = append(c.Messages, db.Message{Role: "assistant", Content: reply, Timestamp: time.Now().Unix()})
	c.UpdatedAt = time.Now().Unix()
	if err := s.store.SaveConversation(clientID, c); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	// If voice is enabled, generate audio for the reply.
	// The audio is returned as base64 in the response so the frontend can
	// play it without needing a separate request.
	settings, err := s.store.GetAppSettings(clientID)
	if err == nil && settings.Voice {
		speed := settings.VoiceSpeed
		if speed < 1 {
			speed = 1
		}
		if speed > 10 {
			speed = 10
		}
		audioBytes, err := voice.SpeakToBytesWithVoice(reply, voiceName(settings.VoiceName), speed, false)
		if err != nil {
			log.Printf("[voice] TTS generation failed: %v", err)
		} else if len(audioBytes) > 0 {
			writeJSON(w, http.StatusOK, map[string]any{
				"conversation": c,
				"audio":        base64.StdEncoding.EncodeToString(audioBytes),
				"audio_mime":   "audio/mpeg",
			})
			return
		}
	}

	writeJSON(w, http.StatusOK, c)
}

func storyContext(messages []db.Message) []db.Message {
	context := make([]db.Message, 0, len(messages))
	lastUser := -1
	for i, message := range messages {
		if message.Role == "user" {
			lastUser = i
		}
	}
	for i, message := range messages {
		if message.Role == "assistant" || i == lastUser {
			context = append(context, message)
		}
	}
	return context
}

// handleRegenerate removes the last assistant message from a conversation
// and generates a fresh response using the same conversation history.
func (s *Server) handleRegenerate(w http.ResponseWriter, r *http.Request) {
	clientID := clientIDFromRequest(r)
	var req struct {
		ConversationID string `json:"conversation_id"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid payload: "+err.Error())
		return
	}
	if req.ConversationID == "" {
		writeErr(w, http.StatusBadRequest, "conversation_id is required")
		return
	}

	c, err := s.store.GetConversation(clientID, req.ConversationID)
	if err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}

	// Find the last assistant message and the last user message before it.
	lastUserIdx := -1
	lastAssistantIdx := -1
	for i := len(c.Messages) - 1; i >= 0; i-- {
		if c.Messages[i].Role == "assistant" && lastAssistantIdx == -1 {
			lastAssistantIdx = i
		}
		if c.Messages[i].Role == "user" && lastUserIdx == -1 {
			lastUserIdx = i
		}
		if lastUserIdx != -1 && lastAssistantIdx != -1 {
			break
		}
	}

	if lastAssistantIdx == -1 || lastUserIdx == -1 || lastUserIdx >= lastAssistantIdx {
		writeErr(w, http.StatusBadRequest, "no assistant message to regenerate")
		return
	}

	// Remove the last assistant message and any messages after the last user
	// message so the LLM regenerates from a clean state.
	c.Messages = c.Messages[:lastUserIdx+1]

	// Resolve provider.
	p, err := s.store.GetProvider(c.Settings.ProviderID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "conversation has no valid provider: "+err.Error())
		return
	}

	// Re-generate the response.
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()
	history := c.Messages
	if c.Settings.Mode == "story" {
		history = storyContext(c.Messages)
	}
	reply, err := s.llm.Chat(ctx, p, c.Settings.Model, c.Settings.SystemPrompt, history, c.Settings.MaxTurns)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}

	// DEBUG: print the raw AI response to the console.
	log.Printf("[regenerate] AI response: %s", reply)

	// Save the new assistant reply.
	c.Messages = append(c.Messages, db.Message{Role: "assistant", Content: reply, Timestamp: time.Now().Unix()})
	c.UpdatedAt = time.Now().Unix()
	if err := s.store.SaveConversation(clientID, c); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	// If voice is enabled, generate audio for the reply.
	settings, err := s.store.GetAppSettings(clientID)
	if err == nil && settings.Voice {
		speed := settings.VoiceSpeed
		if speed < 1 {
			speed = 1
		}
		if speed > 10 {
			speed = 10
		}
		audioBytes, err := voice.SpeakToBytesWithVoice(reply, voiceName(settings.VoiceName), speed, false)
		if err != nil {
			log.Printf("[voice] TTS generation failed: %v", err)
		} else if len(audioBytes) > 0 {
			writeJSON(w, http.StatusOK, map[string]any{
				"conversation": c,
				"audio":        base64.StdEncoding.EncodeToString(audioBytes),
				"audio_mime":   "audio/mpeg",
			})
			return
		}
	}

	writeJSON(w, http.StatusOK, c)
}

// summarizeTitle derives a short title from the first user message.
func summarizeTitle(msg string) string {
	msg = strings.TrimSpace(msg)
	// Collapse whitespace.
	fields := strings.Fields(msg)
	msg = strings.Join(fields, " ")
	if len(msg) > 40 {
		msg = msg[:40] + "…"
	}
	if msg == "" {
		return "New Chat"
	}
	return msg
}

// logMiddleware logs each request.
func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s (%s)", r.Method, r.URL.Path, time.Since(start))
	})
}

// Run starts the HTTP server on addr.
func Run(addr string, store db.Store, llmClient *llm.Client) error {
	s := New(store, llmClient)
	return http.ListenAndServe(addr, logMiddleware(s.Handler()))
}
