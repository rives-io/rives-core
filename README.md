# World Arcade

```
Cartesi Rollups Node version: 1.2.x (sunodo version 0.10.x)
```

The World Arcade allows users to play riscv-binaries of games on a RISC-v Cartesi Machine on the browser, submit the game moves onchain so the session will be replayed a Cartesi Rollups DApp to generate a provable score. Naturally you can upload you own games.

DISCLAIMERS

For now, this is not a final product and should not be used as one.

## Requirements

- [npm](https://docs.npmjs.com/cli/v9/configuring-npm/install) to install dependencies and run the frontend
- [Sunodo](https://github.com/sunodo/sunodo) to build and run the DApp backend
- [Metamask](https://metamask.io/) to sign transactions in the frontend
- [json-schema-to-typescript](https://www.npmjs.com/package/json-schema-to-typescript) to generate typescript interfaces`npm install -g json-schema-to-typescript --save`
-[cartesi-client](https://github.com/prototyp3-dev/cartesi-client/), an interface to cartesi rollups framework

To build the DApp, two images are also required: `riv/toolchain` and `sunodo/sdk:0.2.0-riv`.

- To generate `riv/toolchain`, clone [RIV repository](https://github.com/edubart/riv) and in its directory do:
```shell
make toolchain
```

- To generate `sunodo/sdk:0.2.0-riv`, in the `world-arcade` project directory do:
```shell
docker build --tag sunodo/sdk:0.2.0-riv . --target sunodo-riv --progress plain .
```

## Building

Build backend with:

```shell
sunodo build
```

You should also install the frontend dependencies. First install [cartesi client](https://github.com/prototyp3-dev/cartesi-client), then run:

```shell
cd frontend
yarn
npm link cartesi-client
```

## Running

Run the DApp environment with:

```shell
sunodo run
```

Then deploy the Rives Screenshot NFT contract (you should have already installed frontend dependencies)

```shell
cd frontend
MNEMONIC='test test test test test test test test test test test junk'
RPC_URL=http://127.0.0.1:8545
DAPP_ADDRESS=0x70ac08179605AF2D9e75782b8DEcDD3c22aA4D0C
BITMASK_ADDRESS=0xF5B2d8c81cDE4D6238bBf20D3D77DB37df13f735
forge create --constructor-args $DAPP_ADDRESS --rpc-url "$RPC_URL" --mnemonic "$MNEMONIC" --json contracts/RivesScoreNFT.sol:RivesScoreNFT --libraries node_modules/@cartesi/util/contracts/Bitmask.sol:Bitmask:$BITMASK_ADDRESS
```

Finally, run the frontend

```shell
cd frontend
yarn dev
```

You will be able to mint the NFTs once the epoch has finished, but you can increase the time of the local dev chain with

```shell
curl -H "Content-Type: application/json"  -X POST --data '{"id":1337,"jsonrpc":"2.0","method":"evm_increaseTime","params":[864000]}' http://localhost:8545
```

## (Cartesapp) Generating frontend libs

Import cartesapp manager and add module

```python
from cartesapp.manager import Manager
m = Manager()
m.add_module('app')
```

To create (or merge) the frontend structure:

```python
m.create_frontend()
```

To (re)generate frontend libs based on backend (on a specific path, default is `src`):

```python
m.generate_frontend_lib("app/backend-libs")
```

Then install frontend dependencies:

```shell
cd frontend
yarn
```

Link cartesi client lib (in `./frontend`), redo this step every time you install or remeve a package:

```shell
npm link cartesi-client
```

Now you can use the generated libs on the frontend. Check examples in `./misc/dry-run.ts`
