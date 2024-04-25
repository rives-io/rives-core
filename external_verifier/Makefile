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
run: --load-env --check-envs rivemu InputBox.json ; $(value setup_venv)
	python external_verifier.py $(ARGS)

run-%: --load-env-% --check-envs rivemu InputBox.json ; $(value setup_venv)
	python external_verifier.py $(ARGS)

run-cloud-services: --load-env --check-envs rivemu InputBox.json ; $(value setup_venv)
	dagster dev -f __init__.py $(ARGS)

run-cloud-services-%: --load-env-% --check-envs rivemu InputBox.json ; $(value setup_venv)
	dagster dev -f __init__.py $(ARGS)

# Aux env targets
--load-env: ${ENVFILE}
	$(eval include include $(shell pwd)/${ENVFILE})

${ENVFILE}:
	@test ! -f $@ && echo "$(ENVFILE) not found. Creating with default values" 
	echo ROLLUP_HTTP_SERVER_URL=http://localhost:8080/rollup >> $(ENVFILE)

--load-env-%: ${ENVFILE}.%
	@$(eval include include $^)

${ENVFILE}.%:
	test ! -f $@ && $(error "file $@ doesn't exist")

--check-envs: --check-opaddr-env --check-rivemu-env --check-daddr-env --check-priv-env
--check-opaddr-env:
	@test ! -z '${OPERATOR_ADDRESS}' || echo "Must define OPERATOR_ADDRESS in env" && test ! -z '${OPERATOR_ADDRESS}'

--check-rivemu-env:
	@test ! -z '${RIVEMU_PATH}' || echo "Must define RIVEMU_PATH in env" && test ! -z '${RIVEMU_PATH}'

--check-daddr-env:
	@test ! -z '${CRAPP_ADDRESS}' || echo "Must define CRAPP_ADDRESS in env" && test ! -z '${CRAPP_ADDRESS}'

--check-priv-env:
	@test ! -z '${PRIVATE_KEY}' || echo "Must define PRIVATE_KEY in env" && test ! -z '${PRIVATE_KEY}'

rivemu: ../rivemu

InputBox.json:
	docker run --rm sunodo/devnet:$(SUNODO_DEVNET_VERSION) bash -c "cat localhost.json | jq '.contracts.InputBox' " | sed  "/^0x/d" > InputBox.json

../rivemu:
	make -C .. rivemu