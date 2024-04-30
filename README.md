# RIVES CORE

```
Cartesi Rollups Node version: 1.2.x (sunodo version 0.10.x)
```

The RiscV Entertainment System (RIVES) CORE allows users to play riscv-binaries of games on a RISC-v Cartesi Machine on the browser, submit the game moves onchain so the session will be replayed a Cartesi Rollups App to generate a provable score. Naturally you can upload you own games.

DISCLAIMERS

For now, this is not a final product and should not be used as one.

## Requirements

- [npm](https://docs.npmjs.com/cli/v9/configuring-npm/install) to install dependencies and run the frontend
- [Sunodo](https://github.com/sunodo/sunodo) to build and run the DApp backend
- [Metamask](https://metamask.io/) to sign transactions in the frontend
- [json-schema-to-typescript](https://www.npmjs.com/package/json-schema-to-typescript) to generate typescript interfaces`npm install -g json-schema-to-typescript --save`
- [cartesi-client](https://github.com/prototyp3-dev/cartesi-client/), an interface to cartesi rollups framework
- [cartesapp](https://github.com/prototyp3-dev/cartesapp/), an high level framwork for python cartesi rollup app

To build the DApp, two images are also required: `riv/toolchain` and `sunodo/sdk:0.2.0-riv`.

- To generate `riv/toolchain`, clone [RIV repository](https://github.com/edubart/riv) and in its directory do:

```shell
make toolchain
```

- To generate `sunodo/sdk:0.2.0-riv`, in the `rives-core` project directory do:

```shell
make sunodo-sdk-riv
```

You should also install the frontend dependencies. First install [cartesi client](https://github.com/prototyp3-dev/cartesi-client), then run:

```shell
cd frontend
yarn
npm link cartesi-client
```

## Building

Define a .env file with some variables:

```shell
OPERATOR_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

Build backend with:

```shell
make build
```

Hint: you can create `.env.[ENV]` files to define other enviroments, and then run:

```shell
make build-[ENV]
```

## Running

Run the DApp environment with (this command runs `sunodo run`):

```shell
make run
```

Then run the externa

Run the frontend

```shell
cd frontend
yarn dev
```

Finally, you should also run the gif server

```shell
cd frontend
yarn dev
```

### Running Backend in the host

To run the backend in host mode and speedup the development process you should run the node in dev mode

```shell
make run-dev
```

Obs: you should define the following variables in `.env` file: RIVEMU_PATH, OPERATOR_ADDRESS, and ROLLUP_HTTP_SERVER_URL

Obs: you can find the sources for rivemu [here](https://github.com/edubart/riv)
