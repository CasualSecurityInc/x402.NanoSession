# x402.NanoSession Documentation Makefile

D2_SRC = $(wildcard docs/diagrams/*.d2)
D2_OUT = $(patsubst docs/diagrams/%.d2,docs/img/%_d2.svg,$(D2_SRC))

.PHONY: all diagrams d2 clean

all: diagrams d2

# Legacy Mermaid generation (via Kroki API)
diagrams:
	@echo "Generating Mermaid diagrams via Kroki..."
	uv run scripts/render_diagrams.py

# Modern D2 generation (Local & Offline)
d2: $(D2_OUT)

docs/img/%_d2.svg: docs/diagrams/%.d2
	@mkdir -p docs/img
	@echo "Compiling $< -> $@..."
	d2 --theme=0 $< $@

clean:
	rm -rf docs/img/*.svg
