# Commands to test the App

## Interacting with WA

### Mutations

```shell
input=0x5e44f4cd000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000047465737400000000000000000000000000000000000000000000000000000000
```

```shell
sunodo send generic --chain-id=31337 --rpc-url=http://127.0.0.1:8545 \
    --mnemonic-index=0 --mnemonic-passphrase='test test test test test test test test test test test junk'\
    --dapp=0x70ac08179605AF2D9e75782b8DEcDD3c22aA4D0C --input=$input
```

### Queries

```shell
curl http://localhost:8080/inspect/app/all_cartridges | jq -r '.reports[0].payload' | xxd -r -p
```

```shell
curl http://localhost:8080/inspect/app/cartridge_info?id=test2 | jq -r '.reports[0].payload' | xxd -r -p
```
