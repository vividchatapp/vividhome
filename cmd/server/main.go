package main

import (
	"flag"
	"log"
	"os"
	"path/filepath"

	"pi-chat-gateway/internal/db"
	"pi-chat-gateway/internal/llm"
	"pi-chat-gateway/internal/server"
)

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	dataDir := flag.String("data", "./data", "data directory for JSON storage")
	llmDump := flag.String("llm-dump", "", "if set, directory where raw LLM requests/responses are dumped")
	flag.Parse()

	// Ensure data directory exists.
	if err := os.MkdirAll(*dataDir, 0o755); err != nil {
		log.Fatalf("failed to create data dir: %v", err)
	}

	store, err := db.NewJSONStore(*dataDir)
	if err != nil {
		log.Fatalf("failed to init store: %v", err)
	}

	llmClient := llm.NewClient()
	if *llmDump != "" {
		if err := os.MkdirAll(*llmDump, 0o755); err != nil {
			log.Fatalf("failed to create llm dump dir: %v", err)
		}
		llmClient.DumpDir = *llmDump
		log.Printf("llm dump enabled: %s", filepath.Clean(*llmDump))
	}

	log.Printf("pi-chat-gateway listening on %s (data: %s)", *addr, filepath.Clean(*dataDir))
	if err := server.Run(*addr, store, llmClient); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
