# x402.NanoSession Documentation Makefile

.PHONY: all diagrams clean

all: diagrams

diagrams:
	@echo "Generating diagrams via Kroki..."
	uv run scripts/render_diagrams.py

clean:
	rm -rf docs/img/*.svg