# Makefile

ENVFILE := .env

SHELL := /bin/bash

SUNODO_DEVNET_VERSION := 1.4.0

define setup_venv =
@if [ ! -d .venv ]; then python3 -m venv .venv; fi
@if [[ "VIRTUAL_ENV" != "" ]]; then . .venv/bin/activate; fi
@if [ -z "$(pip freeze)" ]; then
	if [ -f requirements.txt ]; then 
		pip install -r requirements.txt;
		pip install dagster-webserver
	else
		pip install git+https://github.com/prototyp3-dev/cartesapp@main --find-links https://prototyp3-dev.github.io/pip-wheels-riscv/wheels/
		pip install web3
		pip install redis
		pip install python-dotenv
		pip install py-expression-eval
		echo --find-links https://prototyp3-dev.github.io/pip-wheels-riscv/wheels/ >> requirements.txt
		pip freeze >> requirements.txt
		pip install dagster-webserver
	fi
fi
endef

.ONESHELL:

all: build build-reader-node

setup-env: ; $(value setup_venv)

# Run targets
run: ${ENVFILE} --check-envs rivemu InputBox.json ; $(value setup_venv)
	set -a && source $< && python external_verifier.py $(ARGS)

run-%: ${ENVFILE}.% --check-envs-% rivemu InputBox.json ; $(value setup_venv)
	set -a && source $< && python external_verifier.py $(ARGS)

run-cloud-services: ${ENVFILE} --check-envs rivemu InputBox.json ; $(value setup_venv)
	set -a && source $< && dagster dev -f __init__.py $(ARGS)

run-cloud-services-%: ${ENVFILE}.% --check-envs-% rivemu InputBox.json ; $(value setup_venv)
	set -a && source $< && dagster dev -f __init__.py $(ARGS)

# Aux env targets
--load-env: ${ENVFILE}
	$(eval include include $(shell pwd)/${ENVFILE})

${ENVFILE}:
	@test ! -f $@ && echo "$(ENVFILE) not found. Creating with default values" 
	echo RIVEMU_PATH=../rivemu >> $(ENVFILE)
	echo DAPP_ADDRESS=0xab7528bb862fb57e8a2bcd567a2e929a0be56a5e >> $(ENVFILE)
	echo OPERATOR_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 >> $(ENVFILE)
	echo PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 >> $(ENVFILE)

--load-env-%: ${ENVFILE}.%
	@$(eval include include $<)

${ENVFILE}.%:
	test ! -f $@ && $(error "file $@ doesn't exist")

--check-envs: --load-env
	@set -e
	@test ! -z '${OPERATOR_ADDRESS}' || (echo "Must define OPERATOR_ADDRESS in env" && exit 1)
	@test ! -z '${RIVEMU_PATH}' || (echo "Must define RIVEMU_PATH in env" && exit 1)
	@test ! -z '${DAPP_ADDRESS}' || (echo "Must define DAPP_ADDRESS in env" && exit 1)
	@test ! -z '${PRIVATE_KEY}' || (echo "Must define PRIVATE_KEY in env" && exit 1)

--check-envs-%: --load-env-%
	@set -e
	@test ! -z '${OPERATOR_ADDRESS}' || (echo "Must define OPERATOR_ADDRESS in env" && false)
	@test ! -z '${RIVEMU_PATH}' || (echo "Must define RIVEMU_PATH in env" && false)
	@test ! -z '${DAPP_ADDRESS}' || (echo "Must define DAPP_ADDRESS in env" && false)
	@test ! -z '${PRIVATE_KEY}' || (echo "Must define PRIVATE_KEY in env" && false)


rivemu: ../rivemu

InputBox.json:
	docker run --rm sunodo/devnet:$(SUNODO_DEVNET_VERSION) bash -c "cat localhost.json | jq '.contracts.InputBox' " | sed  "/^0x/d" > InputBox.json

../rivemu:
	make -C .. rivemu