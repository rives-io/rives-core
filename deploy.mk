# Makefile

CHAIN_ENVFILE := .chain.env

SHELL := /bin/bash

IMAGE_PATH ?= .cartesi/image

.ONESHELL:

template_hash = $(eval template_hash := $$(shell xxd -p -c 32 ${IMAGE_PATH}/hash))$(template_hash)

authority_address = $(eval authority_address := $$(shell cast call --rpc-url ${RPC_URL} ${AUTHORITY_FACTORY} \
     "calculateAuthorityAddress(address,bytes32)(address)" ${OPERATOR_ADDRESS} ${SALT}))$(authority_address)

history_address = $(eval history_address := $$(shell cast call --rpc-url ${RPC_URL} ${HISTORY_FACTORY} \
     "calculateHistoryAddress(address,bytes32)(address)" ${OPERATOR_ADDRESS} ${SALT}))$(history_address)

dapp_address = $(eval dapp_address := $$(shell cast call --rpc-url ${RPC_URL} ${DAPP_FACTORY} \
     "calculateApplicationAddress(address,address,bytes32,bytes32)(address)" \
     ${authority_address} ${OPERATOR_ADDRESS} 0x${template_hash} ${SALT}))$(dapp_address)

authority_owner = $(eval authority_owner := $$(shell cast call --rpc-url ${RPC_URL} ${authority_address} "owner()(address)" \
	 2> /dev/null))$(authority_owner)

history_owner = $(eval history_owner := $$(shell cast call --rpc-url ${RPC_URL} ${history_address} "owner()(address)" \
	 2> /dev/null))$(history_owner)

dapp_owner = $(eval dapp_owner := $$(shell cast call --rpc-url ${RPC_URL} ${dapp_address} "owner()(address)" \
	 2> /dev/null))$(dapp_owner)

authority_history = $(eval authority_history := $$(shell cast call --rpc-url ${RPC_URL} ${authority_address} \
     	 "getHistory()(address)" 2> /dev/null))$(authority_history)

${CHAIN_ENVFILE}.%:
	test ! -f $@ && $(error "file $@ doesn't exist")

--load-chain-env-%: ${CHAIN_ENVFILE}.%
	@$(eval include include $^)

--check-hash:
	@test ! -z '${template_hash}' || (echo "Must build CM backend to get machine hash" && exit 1)

--check-chain-envs-%: --load-chain-env-%
	@if [ -z '${OPERATOR_ADDRESS}' ]; then echo "Must define OPERATOR_ADDRESS in env"; exit 1; fi
	if [ -z '${PRIVATE_KEY}' ]; then echo "Must define PRIVATE_KEY in env"; exit 1; fi
	if [ -z '${RPC_URL}' ]; then echo "Must define RPC_URL in env"; exit 1; fi
	if [ -z '${SALT}' ]; then echo "Must define SALT in env"; exit 1; fi
	if [ -z '${DAPP_FACTORY}' ]; then echo "Must define DAPP_FACTORY in env"; exit 1; fi
	if [ -z '${HISTORY_FACTORY}' ]; then echo "Must define HISTORY_FACTORY in env"; exit 1; fi
	if [ -z '${AUTHORITY_FACTORY}' ]; then echo "Must define AUTHORITY_FACTORY in env"; exit 1; fi

deploy-dapp-%: --check-chain-envs-% --check-hash
	@if [ -z ${dapp_owner} ]; then
		echo "Dapp ${dapp_address} not deployed"
		if [ -z ${history_owner} ]; then
			echo "History ${history_address} not deployed. Deploying..."
			cast send --private-key ${PRIVATE_KEY} --rpc-url ${RPC_URL} ${HISTORY_FACTORY} \
     		 "newHistory(address,bytes32)(address)" ${OPERATOR_ADDRESS} ${SALT} > /dev/null 
		else
			echo "History ${history_address} already deployed"
		fi

		if [ -z ${authority_owner} ]; then
			echo "Authority ${authority_address} not deployed. Deploying..."
			cast send --private-key ${PRIVATE_KEY} --rpc-url ${RPC_URL} ${AUTHORITY_FACTORY} \
     		 "newAuthority(address,bytes32)(address)" ${OPERATOR_ADDRESS} ${SALT} > /dev/null 
			cast send --private-key ${PRIVATE_KEY} --rpc-url ${RPC_URL} ${authority_address} \
     		 "setHistory(address)" ${history_address} > /dev/null 
		else
			echo "Authority ${authority_address} already deployed"
			if [ "${authority_history}" != "${history_address}" ]; then
				echo "Authority history ${authority_history} is different from history ${history_address}. Changing..."
				cast send --private-key ${PRIVATE_KEY} --rpc-url ${RPC_URL} ${authority_address} \
				"setHistory(address)" ${history_address} > /dev/null 
			else
				echo "Authority history is already ${history_address}"
			fi
		fi

		cast send --private-key ${PRIVATE_KEY} --rpc-url ${RPC_URL} ${DAPP_FACTORY} \
		 "newApplication(address,address,bytes32,bytes32)(address)" \
		 ${authority_address} ${OPERATOR_ADDRESS} 0x${template_hash} ${SALT} > /dev/null 
		
		echo "Deployed dapp ${dapp_address}"
	else
		echo "Dapp ${dapp_address} already deployed"
	fi

