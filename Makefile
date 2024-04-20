# Makefile

ENVFILE := .env

SHELL := /bin/bash

RIV_VERSION := 0.3-rc7

define setup_venv =
@if [ ! -d .venv ]; then python3 -m venv .venv; fi
@if [[ "VIRTUAL_ENV" != "" ]]; then . .venv/bin/activate; fi
@if [ -z "$(pip freeze)" ]; then
	if [ -f requirements.txt ]; then 
		pip install -r requirements.txt
		pip install git+https://github.com/prototyp3-dev/cartesapp@main#egg=cartesapp[dev] --find-links https://prototyp3-dev.github.io/pip-wheels-riscv/wheels/
		pip install pytest-order
	else
		pip install git+https://github.com/prototyp3-dev/cartesapp@main --find-links https://prototyp3-dev.github.io/pip-wheels-riscv/wheels/
		echo --find-links https://prototyp3-dev.github.io/pip-wheels-riscv/wheels/ >> requirements.txt
		pip install py-expression-eval
		pip freeze >> requirements.txt
		pip install git+https://github.com/prototyp3-dev/cartesapp@main#egg=cartesapp[dev] --find-links https://prototyp3-dev.github.io/pip-wheels-riscv/wheels/
		pip install pytest-order
	fi
fi
endef

.ONESHELL:

all: sunodo-riv build build-reader-node

setup-env: ; $(value setup_venv)

# build targets
build: --load-env --check-opaddr-env ; $(value setup_venv)
	cartesapp build --config user=root --config build-args=OPERATOR_ADDRESS=${OPERATOR_ADDRESS} $(ARGS)

build-reader-node: ; $(value setup_venv)
	cartesapp build-reader-image $(ARGS)

build-dev-node: ; $(value setup_venv)
	cartesapp build-dev-image $(ARGS)

build-%: --load-env-% --check-opaddr-env ; $(value setup_venv)
	cartesapp build --config user=root --config build-args=OPERATOR_ADDRESS=${OPERATOR_ADDRESS}\
	 --config envs=RIVES_VERSION=$(shell git log -1 --format="%at" | xargs -I{} date -d @{} +%Y%m%d.%H%M).$(shell git rev-parse --short HEAD)\
	 $(ARGS)

# Run targets
run: --load-env --check-rivemu-env --check-opaddr-env --check-roladdr-env ; $(value setup_venv)
	cartesapp node $(ARGS)

run-dev: --load-env --check-rivemu-env --check-opaddr-env --check-roladdr-env rivemu ; $(value setup_venv)
	RIVEMU_PATH=${RIVEMU_PATH} OPERATOR_ADDRESS=${OPERATOR_ADDRESS} ROLLUP_HTTP_SERVER_URL=${ROLLUP_HTTP_SERVER_URL} cartesapp node --mode dev $(ARGS)

run-reader: ; $(value setup_venv)
	cartesapp node --mode reader $(ARGS)

# Aux env targets
--load-env: ${ENVFILE}
	$(eval include include $(PWD)/${ENVFILE})

${ENVFILE}:
	@test ! -f $@ && echo "$(ENVFILE) not found. Creating with default values" 
	echo ROLLUP_HTTP_SERVER_URL=http://localhost:8080/rollup >> $(ENVFILE)
	echo RIVEMU_PATH=rivemu/rivemu >> $(ENVFILE)
	echo OPERATOR_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 >> $(ENVFILE)

--load-env-%: --${ENVFILE}.%
	@$(eval include include $^)

${ENVFILE}.%:
	test ! -f $@ && $(error "file $@ doesn't exist")

--check-roladdr-env:
	@test ! -z '${ROLLUP_HTTP_SERVER_URL}' || echo "Must define ROLLUP_HTTP_SERVER_URL in env" && test ! -z '${ROLLUP_HTTP_SERVER_URL}'


# custom rives tagets

--check-rivemu-env:
	@test ! -z '${RIVEMU_PATH}' || echo "Must define RIVEMU_PATH in env" && test ! -z '${RIVEMU_PATH}'

--check-opaddr-env:
	@test ! -z '${OPERATOR_ADDRESS}' || echo "Must define OPERATOR_ADDRESS in env" && test ! -z '${OPERATOR_ADDRESS}'

sunodo-riv: sunodo-sdk
sunodo-sdk-riv: sunodo-sdk
sunodo-sdk:
	docker build --tag sunodo/sdk:0.4.0-riv --target sunodo-riv-sdk .

rivemu: rivemu/rivemu
rivemu/rivemu: #rivemu/kernel/linux.bin rivemu/rivos/rivos.ext2
	mkdir -p rivemu
	curl -s -L https://github.com/rives-io/riv/releases/download/v${RIV_VERSION}/rivemu-linux-$(shell dpkg --print-architecture) -o rivemu/rivemu
	chmod +x rivemu/rivemu

build-release:
	docker build -f Dockerfile --target node .sunodo/ -t ghcr.io/rives/rives-core:$(shell git log -1 --format="%at" | xargs -I{} date -d @{} +%Y%m%d.%H%M).$(shell git rev-parse --short HEAD)

# Test targets
test-verbose: --load-env --check-rivemu-env ; $(value setup_venv)
	RIVEMU_PATH=${RIVEMU_PATH} pytest --capture=no --log-cli-level=DEBUG --maxfail=1 --order-dependencies

