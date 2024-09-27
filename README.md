# RIVES CORE

```
Cartesi Rollups Node version: 1.5.x (cartesi cli version 0.15.x)
```

The RiscV Entertainment System (RIVES) CORE allows users to play riscv-binaries of games on a RISC-v Cartesi Machine on the browser, submit the game moves onchain so the session will be replayed a Cartesi Rollups App to generate a provable score. Naturally you can upload you own games.

DISCLAIMERS

For now, this is not a final product and should not be used as one.

## Requirements

- [cartesi-cli](https://github.com/cartesi/cli) to build and run the DApp backend
- [npm](https://docs.npmjs.com/cli/v9/configuring-npm/install) and [json-schema-to-typescript](https://www.npmjs.com/package/json-schema-to-typescript) to generate typescript interfaces`npm install -g json-schema-to-typescript --save`
- [cartesi-client](https://github.com/prototyp3-dev/cartesi-client/), an interface to cartesi rollups framework
- [cartesapp](https://github.com/prototyp3-dev/cartesapp/), an high level framwork for python cartesi rollup app

To build the DApp, two images are also required: `riv/toolchain` and `castesi/sdk:<version>-riv`.

- To generate `riv/toolchain`, clone [RIV repository](https://github.com/rives-io/riv) and in its directory do:

```shell
make toolchain
```

- To generate `castesi/sdk:<version>-riv`, in the `rives-core` project directory do:

```shell
make cartesi-riv
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

Run the DApp environment with (this command runs `cartesi run`):

```shell
make run
```

Then run the external verifier

```shell
make run-external-verifier
```

### Running Backend in the host

To run the backend in host mode and speedup the development process you should run the node in dev mode

```shell
make run-dev
```

Obs: you should define the following variables in `.env` file: RIVEMU_PATH, OPERATOR_ADDRESS, and ROLLUP_HTTP_SERVER_URL

Obs: you can find the sources for rivemu [here](https://github.com/rives-io/riv)
