# Makefile

ENVFILE := .env

SHELL := /bin/bash

RIV_VERSION := 0.3-rc11

RIVES_VERSION := $(shell git log -1 --format="%at" | xargs -I{} date -d @{} +%Y%m%d.%H%M).$(shell git rev-parse --short HEAD)

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
	cartesapp build --config user=root --config envs=OPERATOR_ADDRESS=${OPERATOR_ADDRESS} $(ARGS)

build-reader-node: ; $(value setup_venv)
	cartesapp build-reader-image $(ARGS)

build-dev-node: ; $(value setup_venv)
	cartesapp build-dev-image $(ARGS)

build-%: --load-env-% --check-opaddr-env ; $(value setup_venv)
	cartesapp build --config user=root --config envs=OPERATOR_ADDRESS=${OPERATOR_ADDRESS},RIVES_VERSION=${RIVES_VERSION} $(ARGS)

# Run targets
run: --load-env --check-rivemu-env --check-opaddr-env --check-roladdr-env ; $(value setup_venv)
	cartesapp node $(ARGS)

run-dev: --load-env --check-rivemu-env --check-opaddr-env --check-roladdr-env rivemu ; $(value setup_venv)
	RIVEMU_PATH=${RIVEMU_PATH} OPERATOR_ADDRESS=${OPERATOR_ADDRESS} ROLLUP_HTTP_SERVER_URL=${ROLLUP_HTTP_SERVER_URL} cartesapp node --mode dev $(ARGS)

run-reader: ; $(value setup_venv)
	cartesapp node --mode reader $(ARGS)

run-frontend-dev:
	make -C frontend run-dev

build-frontend:
	make -C frontend build

generate-frontend-libs: ; $(value setup_venv)
	cartesapp generate-frontend-libs --libs-path app/backend-libs

# Aux env targets
--load-env: ${ENVFILE}
	$(eval include include $(PWD)/${ENVFILE})

${ENVFILE}:
	@test ! -f $@ && echo "$(ENVFILE) not found. Creating with default values" 
	echo ROLLUP_HTTP_SERVER_URL=http://localhost:8080/rollup >> $(ENVFILE)
	echo RIVEMU_PATH=rivemu >> $(ENVFILE)
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

rivemu:
	curl -s -L https://github.com/rives-io/riv/releases/download/v${RIV_VERSION}/rivemu-linux-$(shell dpkg --print-architecture) -o rivemu
	chmod +x rivemu

--remove-rivemu:
	rm -rf rivemu

update-rivemu: --remove-rivemu rivemu

update-frontend-rivemu:
	curl -s -L https://github.com/rives-io/riv/releases/download/v${RIV_VERSION}/rivemu.js -o frontend/public/rivemu.js
	curl -s -L https://github.com/rives-io/riv/releases/download/v${RIV_VERSION}/rivemu.wasm -o frontend/public/rivemu.wasm

build-release:
	IMAGE_VERSION=$$(git log -1 --format="%at" | xargs -I{} date -d @{} +%Y%m%d.%H%M).$$(git rev-parse --short HEAD)
	IMAGE_TAG=ghcr.io/rives-io/rives-core:$$IMAGE_VERSION
	echo $$IMAGE_TAG > .rives-core.tag
	docker build -f Dockerfile --target node .sunodo/ \
		-t $$IMAGE_TAG \
		--label "org.opencontainers.image.title=rives-core" \
		--label "org.opencontainers.image.description=RIVES Core Node" \
		--label "org.opencontainers.image.source=https://github.com/rives-io/rives-core" \
		--label "org.opencontainers.image.revision=$$(git rev-parse HEAD)" \
		--label "org.opencontainers.image.created=$$(date -Iseconds --utc)" \
		--label "org.opencontainers.image.licenses=Apache-2.0" \
		--label "org.opencontainers.image.url=https://rives.io" \
		--label "org.opencontainers.image.version=$$IMAGE_VERSION"

# Test targets
test-verbose: --load-env --check-rivemu-env ; $(value setup_venv)
	RIVEMU_PATH=${RIVEMU_PATH} pytest --capture=no --log-cli-level=DEBUG --maxfail=1 --order-dependencies


run-external-verifier:
	make -C external_verifier run ARGS='$(ARGS)'

run-external-verifier-cloud-services:
	make -C external_verifier run-cloud-services ARGS='$(ARGS)'

build-external-verifier-cloud:
	IMAGE_VERSION=$$(git log -1 --format="%at" | xargs -I{} date -d @{} +%Y%m%d.%H%M).$$(git rev-parse --short HEAD)
	IMAGE_TAG=ghcr.io/rives-io/rives-exteral-verifier:$$IMAGE_VERSION
	echo $$IMAGE_TAG > .external-verifier-cloud.tag
	docker build --target external-verifier-cloud . \
		-t $$IMAGE_TAG \
		--label "org.opencontainers.image.title=rives-external-verifier" \
		--label "org.opencontainers.image.description=RIVES External Verifier" \
		--label "org.opencontainers.image.source=https://github.com/rives-io/rives-core" \
		--label "org.opencontainers.image.revision=$$(git rev-parse HEAD)" \
		--label "org.opencontainers.image.created=$$(date -Iseconds --utc)" \
		--label "org.opencontainers.image.licenses=Apache-2.0" \
		--label "org.opencontainers.image.url=https://rives.io" \
		--label "org.opencontainers.image.version=$$IMAGE_VERSION"
