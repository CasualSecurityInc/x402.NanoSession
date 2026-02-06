# x402.NanoSession Documentation Makefile

DIAGRAMS_SRC = $(wildcard docs/diagrams/*.mmd)
DIAGRAMS_OUT = $(patsubst docs/diagrams/%.mmd,docs/img/%.svg,$(DIAGRAMS_SRC))

.PHONY: all diagrams clean

all: diagrams

diagrams: $(DIAGRAMS_OUT)

docs/img/%.svg: docs/diagrams/%.mmd
	@mkdir -p docs/img
	@echo "Generating $@..."
	npx -p @mermaid-js/mermaid-cli mmdc -i $< -o $@ -b transparent

clean:
	rm -rf docs/img/*.svg
