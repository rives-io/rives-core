# Commands to test the App

## Interacting with WA

### Mutations

```shell
input=0x49ee5e36907ab088197625939b2137998b0efd59f30b3683093733c1ca4e0a62d638e09f86e9ebacee2ca072cc896201d11c142fcfda227f91e88765a6e8136006b5882a00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007f01010404910000000300000000000000676866695dcc416ec3400c43513d4a33751cf4fed7edc2718d165a7c52045945d29d5caca2ead6dd575275f3affe6d74fdfb95f2e4f7fae31fe6731f5fb6c1615949641c96783bf5b56a59c684182c5b7c1b71622b5b6c2ce30c55d1be74062d68949797433b13ef6ca5153a3bf30300
```

```shell
sunodo send generic --chain-id=31337 --rpc-url=http://127.0.0.1:8545 \
    --mnemonic-index=0 --mnemonic-passphrase='test test test test test test test test test test test junk'\
    --dapp=0x70ac08179605AF2D9e75782b8DEcDD3c22aA4D0C --input=$input
```

### Queries

```shell
curl "http://localhost:8080/inspect/app/cartridges" | jq -r '.reports[0].payload' | xxd -r -p | jq
curl "http://localhost:8080/inspect/app/cartridges?tags=2d&name=nake&tags=action" | jq -r '.reports[0].payload' | xxd -r -p | jq
```

```shell
curl curl http://localhost:8080/inspect/app/cartridge_info?id=907ab088197625939b2137998b0efd59f30b3683093733c1ca4e0a62d638e09f | jq -r '.reports[0].payload' | xxd -r -p | jq
```

```shell
curl curl http://localhost:8080/inspect/app/cartridge?id=907ab088197625939b2137998b0efd59f30b3683093733c1ca4e0a62d638e09f | jq -r '.reports[0].payload'
```

```shell
curl http://localhost:8080/inspect/cartesapp/indexer_query?tags=score | jq -r '.reports[0].payload' | xxd -r -p
curl "http://localhost:8080/inspect/cartesapp/indexer_query?tags=replay&msg_sender=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" | jq -r '.reports[0].payload' | xxd -r -p
```
