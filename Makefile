# Makefile

ENVFILE := .env

SHELL := /bin/bash

RIV_VERSION := 0.3-rc16
CARTESI_SDK_RIV_VERSION := 0.6.2-riv

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

all: cartesi-riv build build-reader-node

setup-env: ; $(value setup_venv)

# build targets
build: ${ENVFILE} --check-envs ; $(value setup_venv)
	set -a && source $< && cartesapp build --config user=root --config envs=OPERATOR_ADDRESS=${OPERATOR_ADDRESS},RIVES_VERSION=${RIVES_VERSION},PROXY_ADDRESS=${PROXY_ADDRESS} $(ARGS)

build-reader-node: ; $(value setup_venv)
	cartesapp build-reader-image $(ARGS)

build-dev-node: ; $(value setup_venv)
	cartesapp build-dev-image $(ARGS)

build-%: ${ENVFILE}.% --check-envs-% ; $(value setup_venv)
	set -a && source $< && cartesapp build --config user=root --config envs=OPERATOR_ADDRESS=${OPERATOR_ADDRESS},RIVES_VERSION=${RIVES_VERSION},PROXY_ADDRESS=${PROXY_ADDRESS} $(ARGS)

# Run targets
run: ; $(value setup_venv)
	cartesapp node $(ARGS)

run-dev: ${ENVFILE} rivemu --check-envs --check-dev-envs ; $(value setup_venv)
	set -a && source $< && \
	 cartesapp node --mode dev $(ARGS)

run-reader: ; $(value setup_venv)
	cartesapp node --mode reader $(ARGS)

run-dev-%: ${ENVFILE}.% --check-testnet-envs-% --check-dev-envs-% rivemu ; $(value setup_venv)
	set -a && source $< && \
	 cartesapp node --mode dev --config rpc-url=${RPC_URL} --config contracts-application-address=${DAPP_ADDRESS} --config contracts-input-box-block=${DAPP_DEPLOY_BLOCK} \
	 $(ARGS)

run-reader-%: ${ENVFILE}.% --check-testnet-envs-% ; $(value setup_venv)
	set -a && source $< && cartesapp node --mode reader --config rpc-url=${RPC_URL} --config contracts-application-address=${DAPP_ADDRESS} --config contracts-input-box-block=${DAPP_DEPLOY_BLOCK} $(ARGS)

generate-frontend-libs: ; $(value setup_venv)
	@test ! -z '${FRONTEND_PATH}' || (echo "Must define FRONTEND_PATH in env" && exit 1)
	cartesapp generate-frontend-libs --libs-path app/backend-libs --frontend-path ${FRONTEND_PATH} $(ARGS)

# Aux env targets
--load-env: ${ENVFILE}
	$(eval include include $(PWD)/${ENVFILE})

${ENVFILE}:
	@test ! -f $@ && echo "$(ENVFILE) not found. Creating with default values" 
	echo ROLLUP_HTTP_SERVER_URL=http://localhost:8080/rollup >> $(ENVFILE)
	echo RIVEMU_PATH=rivemu >> $(ENVFILE)
	echo OPERATOR_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 >> $(ENVFILE)
	echo PROXY_ADDRESS=0x00124590193fcd497c0eed517103368113f89258 >> $(ENVFILE)

--load-env-%: ${ENVFILE}.%
	@$(eval include include $^)

${ENVFILE}.%:
	test ! -f $@ && $(error "file $@ doesn't exist")

--check-roladdr-env:
	@test ! -z '${ROLLUP_HTTP_SERVER_URL}' || (echo "Must define ROLLUP_HTTP_SERVER_URL in env" && exit 1)


# custom rives tagets

--check-envs: --load-env
	@test ! -z '${OPERATOR_ADDRESS}' || (echo "Must define OPERATOR_ADDRESS in env" && exit 1)
	@test ! -z '${PROXY_ADDRESS}' || (echo "Must define PROXY_ADDRESS in env" && exit 1)

--check-envs-%: --load-env-%
	@test ! -z '${OPERATOR_ADDRESS}' || (echo "Must define OPERATOR_ADDRESS in env" && exit 1)
	@test ! -z '${PROXY_ADDRESS}' || (echo "Must define PROXY_ADDRESS in env" && exit 1)

--check-rivemu-env:
	@test ! -z '${RIVEMU_PATH}' || (echo "Must define RIVEMU_PATH in env" && exit 1)

--check-dev-envs: --load-env
	@test ! -z '${RIVEMU_PATH}' || (echo "Must define RIVEMU_PATH in env" && exit 1)
	@test ! -z '${ROLLUP_HTTP_SERVER_URL}' || (echo "Must define ROLLUP_HTTP_SERVER_URL in env" && exit 1)

--check-dev-envs-%: --load-env-%
	@test ! -z '${RIVEMU_PATH}' || (echo "Must define RIVEMU_PATH in env" && exit 1)
	@test ! -z '${ROLLUP_HTTP_SERVER_URL}' || (echo "Must define ROLLUP_HTTP_SERVER_URL in env" && exit 1)

--check-testnet-envs-%: --load-env-%
	@test ! -z '${RPC_URL}' || (echo "Must define RPC_URL in env" && exit 1)
	@test ! -z '${DAPP_ADDRESS}' || (echo "Must define DAPP_ADDRESS in env" && exit 1)
	@test ! -z '${DAPP_DEPLOY_BLOCK}' || (echo "Must define DAPP_DEPLOY_BLOCK in env" && exit 1)

cartesi-riv: cartesi-sdk
cartesi-sdk-riv: cartesi-sdk
cartesi-sdk:
	docker build --tag cartesi/sdk:${CARTESI_SDK_RIV_VERSION} --target cartesi-riv-sdk .

rivemu:
	curl -s -L https://github.com/rives-io/riv/releases/download/v${RIV_VERSION}/rivemu-linux-$(shell dpkg --print-architecture) -o rivemu
	chmod +x rivemu

--remove-rivemu:
	rm -rf rivemu

update-rivemu: --remove-rivemu rivemu

build-release:
	IMAGE_VERSION=$$(git log -1 --format="%at" | xargs -I{} date -d @{} +%Y%m%d.%H%M).$$(git rev-parse --short HEAD)
	IMAGE_TAG=ghcr.io/rives-io/rives-core:$$IMAGE_VERSION
	echo $$IMAGE_TAG > .rives-core.tag
	docker build -f Dockerfile --target node .cartesi/ \
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
	IMAGE_VERSION=$$(git log -1 --format="%at" | xargs -I{} date -d @{} +%Y%m%d.%H%M).$$(git rev-parse --short HEAD)-b
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
