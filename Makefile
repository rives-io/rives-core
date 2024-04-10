# Makefile

ENVFILE := .env

SHELL := /bin/bash

define setup_venv =
@if [ ! -d .venv ]; then python3 -m venv .venv; fi
@if [[ "VIRTUAL_ENV" != "" ]]; then . .venv/bin/activate; fi
@if [ -z "$(pip freeze)" ]; then
	if [ -f requirements.txt ]; then 
		pip install -r requirements.txt;
	else
		pip install git+https://github.com/prototyp3-dev/cartesapp@main --find-links https://prototyp3-dev.github.io/pip-wheels-riscv/wheels/
		echo --find-links https://prototyp3-dev.github.io/pip-wheels-riscv/wheels/ >> requirements.txt
		pip freeze >> requirements.txt
	fi
fi
endef

.ONESHELL:

all: build build-reader-node

# build targets
build: --load-env --check-opaddr-env ; $(value setup_venv)
	cartesapp build --config build-args=OPERATOR_ADDRESS=${OPERATOR_ADDRESS}

build-reader-node: ; $(value setup_venv)
	cartesapp build-reader-image

build-dev-node: ; $(value setup_venv)
	cartesapp build-dev-image

build-%: --load-env-% --check-opaddr-env ; $(value setup_venv)
	cartesapp build --config build-args=OPERATOR_ADDRESS=${OPERATOR_ADDRESS}

# Run targets
run: --load-env --check-rivemu-env --check-opaddr-env --check-roladdr-env ; $(value setup_venv)
	cartesapp node

run-dev: --load-env --check-rivemu-env --check-opaddr-env --check-roladdr-env ; $(value setup_venv)
	RIVEMU_PATH=${RIVEMU_PATH} OPERATOR_ADDRESS=${OPERATOR_ADDRESS} ROLLUP_HTTP_SERVER_URL=${ROLLUP_HTTP_SERVER_URL} cartesapp node --mode dev

run-reader: ; $(value setup_venv)
	cartesapp node --mode reader

# Test targets
test-verbose: --load-env --check-rivemu-env ; $(value setup_venv)
	echo RIVEMU_PATH=${RIVEMU_PATH} pytest --capture=no --log-cli-level=DEBUG --maxfail=1 --order-dependencies


# Aux env targets
--load-env:
	$(eval include include $(PWD)/${ENVFILE})

--load-env-%: --${ENVFILE}.%
	@$(eval include include $^)

--${ENVFILE}.%:
	test ! -f $@ && $(error "file $@ doesn't exist")

--check-roladdr-env:
	@test ! -z '${ROLLUP_HTTP_SERVER_URL}' || echo "Must define ROLLUP_HTTP_SERVER_URL in env" && test ! -z '${ROLLUP_HTTP_SERVER_URL}'


# custom rives tagets

--check-rivemu-env:
	@test ! -z '${RIVEMU_PATH}' || echo "Must define RIVEMU_PATH in env" && test ! -z '${RIVEMU_PATH}'

--check-opaddr-env:
	@test ! -z '${OPERATOR_ADDRESS}' || echo "Must define OPERATOR_ADDRESS in env" && test ! -z '${OPERATOR_ADDRESS}'
