from pydantic2ts.cli.script import generate_json_schema
import os
import json
import subprocess
import tempfile
from jinja2 import Template
from packaging.version import Version

FRONTEND_PATH = 'frontend'
SRC_FRONTEND_PATH = f"{FRONTEND_PATH}/src"
PACKAGES_JSON_FILENAME = "package.json"
TSCONFIG_JSON_FILENAME = "tsconfig.json"

def convert_camel_case(s):
    splitted = s.split('_')
    return splitted[0] + ''.join(i.title() for i in splitted[1:])

def render_templates(conf,settings,mutations_info,queries_info,notices_info,reports_info,modules_to_add):

    add_indexer_query = False
    for module_name in settings:
        if getattr(settings[module_name],'index_outputs'): 
            add_indexer_query = True
            break

    # print(conf,settings,mutations_info,queries_info,notices_info,reports_info,modules_to_add)

    modules = ['cartesapp'] 
    modules.extend(modules_to_add)
    modules_processed = []
    while len(modules_to_add) > 0:
        if 'cartesapp' not in modules_processed:
            module_name = 'cartesapp'
        else:
            module_name = modules_to_add.pop()
        modules_processed.append(module_name)

        module_notices_info = [i for i in notices_info.values() if i['module'] == module_name]
        module_reports_info = [i for i in reports_info.values() if i['module'] == module_name]
        module_vouchers_info = []  # TODO: add this (also add voucher info on manager)
        module_mutations_info = [i for i in mutations_info.values() if i['module'] == module_name]
        module_queries_info = [i for i in queries_info.values() if i['module'] == module_name]

        mutations_payload_info  = [dict(p) for p in set([(("abi_types",tuple(i["abi_types"])),("model",i["model"])) for i in module_mutations_info])]
        for i in mutations_payload_info: i["abi_types"] = list(i["abi_types"])
        queries_payload_info    = [dict(p) for p in set([(("abi_types",tuple(i["abi_types"])),("model",i["model"])) for i in module_queries_info])]
        for i in queries_payload_info: i["abi_types"] = list(i["abi_types"])

        models = []
        models.extend(map(lambda i:i['model'],module_notices_info))
        models.extend(map(lambda i:i['model'],module_reports_info))
        models.extend(map(lambda i:i['model'],module_vouchers_info))
        models.extend(map(lambda i:i['model'],module_mutations_info))
        models.extend(map(lambda i:i['model'],module_queries_info))
        models = list(set(models))

        frontend_lib_path = f"{SRC_FRONTEND_PATH}/{module_name}"

        if len(models) > 0:

            schema = generate_json_schema(models)

            if not os.path.exists(frontend_lib_path):
                os.makedirs(frontend_lib_path)

            output_filepath = f"{frontend_lib_path}/ifaces.d.ts"

            schema_temp = tempfile.NamedTemporaryFile()
            schema_file = schema_temp.file
            schema_file_path = schema_temp.name

            with open(schema_file_path, "w") as f:
                f.write(schema)

            args = ["npx","json2ts"]
            args.extend(["-i",schema_file_path])
            args.extend(["-o",output_filepath])

            result = subprocess.run(args, capture_output=True, text=True)
            if result.returncode > 0:
                raise Exception("Error generating typescript interfaces")

            schema_temp.close()

        has_indexer_query = False
        module_setting = settings.get(module_name)
        if module_setting is not None:
            has_indexer_query = getattr(module_setting,'index_outputs')

        filepath = f"{frontend_lib_path}/lib.ts"
        if module_name == 'cartesapp':
            # helper_template_file = open('templates/cartesapp-helpers.j2','r')
            # helper_template = helper_template_file.read()
            # helper_template_file.close()

            indexer_query_info = None
            indexer_output_info = None
            if not indexer_output_info:
                indexer_query_info = queries_info[f"{conf['indexer_query'].__module__.split('.')[0]}.{conf['indexer_query'].__name__}"]
                indexer_output_info = reports_info[f"{conf['indexer_output'].__module__.split('.')[0]}.{conf['indexer_output'].__name__}"]

            has_ifaces = add_indexer_query
            helper_template_output = Template(helper_template).render({
                "convert_camel_case":convert_camel_case,
                "add_indexer_query": add_indexer_query,
                "has_ifaces": has_ifaces,
                "indexer_query_info": indexer_query_info,
                "indexer_output_info": indexer_output_info
            })

            with open(filepath, "w") as f:
                f.write(helper_template_output)
        else:
            imports_template_output = Template(lib_imports).render({
                "has_indexer_query": has_indexer_query
            })

            with open(filepath, "w") as f:
                f.write(imports_template_output)

        # lib_template_file = open('templates/lib.j2','r')
        # lib_template = lib_template_file.read()
        # lib_template_file.close()
        
        lib_template_output = Template(lib_template).render({
            "mutations_info":module_mutations_info,
            "queries_info":module_queries_info,
            "mutations_payload_info":mutations_payload_info,
            "queries_payload_info":queries_payload_info,
            "notices_info":module_notices_info,
            "reports_info":module_reports_info,
            "vouchers_info":module_vouchers_info,
            "has_indexer_query": has_indexer_query,
            "convert_camel_case":convert_camel_case
        })

        with open(filepath, "a") as f:
            f.write(lib_template_output)

def get_newer_version(pkg_name,req_version,orig_version):
    if orig_version is None: return req_version
    ov = Version(orig_version.split('~')[-1].split('^')[-1])
    rv = Version(req_version.split('~')[-1].split('^')[-1])
    force_original = False
    if req_version.startswith('~') or orig_version.startswith('~'):
        if ov.major != rv.major or ov.minor != rv.minor:
            force_original = True
    if req_version.startswith('^'):
        if not orig_version.startswith('^') and ov < rv:
            force_original = True
    if orig_version.startswith('^'):
        if not req_version.startswith('^') and rv < ov:
            force_original = True
    if force_original:
        print(f"WARN: Required package {pkg_name} version is {req_version} but original is {orig_version}: keeping original (fix this manually)")
        return orig_version
    newer = orig_version
    if rv > ov: newer = req_version
    return newer


def create_frontend_structure():
    # packages json
    pkg_path = f"{FRONTEND_PATH}/{PACKAGES_JSON_FILENAME}"
    original_pkg = {}
    # merge confs (warn and keep original)
    if os.path.exists(pkg_path) and os.path.isfile(pkg_path):
        with open(pkg_path, "r") as f:
            original_json_str = f.read()
            original_pkg = json.loads(original_json_str)
    for section in packages_json:
        if original_pkg.get(section) is None: original_pkg[section] = {}
        for key in packages_json[section]:
            if "dependencies" in section.lower():
                original_pkg[section][key] = get_newer_version(key,packages_json[section][key],original_pkg[section].get(key))
            else:
                if original_pkg[section].get(key) is not None and original_pkg[section][key] != packages_json[section][key]:
                    print(f"WARN: Required package {key} section is '{packages_json[section][key]}' but original is '{original_pkg[section][key]}': keeping original (fix this manually)")
                original_pkg[section][key] = original_pkg[section].get(key) or packages_json[section][key]

    # tsconfig json
    tscfg_path = f"{FRONTEND_PATH}/{TSCONFIG_JSON_FILENAME}"
    original_tscfg = {}
    # merge confs (warn and keep original)
    if os.path.exists(tscfg_path) and os.path.isfile(tscfg_path):
        with open(tscfg_path, "r") as f:
            original_json_str = f.read()
            original_tscfg = json.loads(original_json_str)
    for section in tsconfig_json:
        if type(tsconfig_json[section]) == type({}):
            if original_tscfg.get(section) is None: original_tscfg[section] = {}
            for key in tsconfig_json[section]:
                if original_tscfg[section].get(key) is not None and original_tscfg[section][key] != tsconfig_json[section][key]:
                    print(f"WARN: Required tsconfig {section} section is '{tsconfig_json[section][key]}' but original is '{original_tscfg[section][key]}': keeping original (fix this manually)")
                original_tscfg[section][key] = original_tscfg[section].get(key) or tsconfig_json[section][key]
        elif type(tsconfig_json[section]) == type([]):
            if original_tscfg.get(section) is None: original_tscfg[section] = []
            for val in tsconfig_json[section]:
                if val not in original_tscfg[section]:
                    original_tscfg[section].append(val)



    if not os.path.exists(FRONTEND_PATH):
        os.makedirs(FRONTEND_PATH)

    with open(pkg_path, "w") as f:
        json_str = json.dumps(original_pkg, indent=2)
        f.write(json_str)

    with open(tscfg_path, "w") as f:
        json_str = json.dumps(original_tscfg, indent=2)
        f.write(json_str)

packages_json = {
    "scripts": {
        # "dry-run": "ts-node src/dry-run.ts",
        "prepare": "ts-patch install"
    },
        "dependencies": {
        "ajv": "^8.12.0",
        "ajv-formats": "^2.1.1",
        "ethers": "^5.7.2"
    },
        "devDependencies": {
        "@types/node": "^20.11.0",
        "ts-patch": "^3.1.2",
        "ts-transformer-keys": "^0.4.4",
        "typescript": "^5.3.3",
        "ts-node": "^10.9.2"
    }
}

tsconfig_json = {
    # "ts-node": {
    #   // This can be omitted when using ts-patch
    #   "compiler": "ts-patch/compiler"
    # },
    "compilerOptions": {
        "strict": True,
        "noEmitOnError": True,
        # "suppressImplicitAnyIndexErrors": true,
        "target": "ES5",
        "plugins": [
            { "transform": "ts-transformer-keys/transformer" }
        ]
    },
    "include": [
      "src"
    ]
}

helper_template = '''/* eslint-disable */
/**
 * This file was automatically generated by cartesapp.template_generator.
 * DO NOT MODIFY IT BY HAND. Instead, run the generator,
 */
import { Signer, ethers, ContractReceipt } from "ethers";
import { keys } from 'ts-transformer-keys';
import Ajv, { ValidateFunction } from "ajv"
import addFormats from "ajv-formats"

import { 
    advanceInput, inspect, 
    AdvanceOutput, InspectOptions, AdvanceInputOptions,
    Report as CartesiReport, Notice as CartesiNotice, Voucher as CartesiVoucher, 
    Maybe, Proof, validateNoticeFromParams, wasVoucherExecutedFromParams, executeVoucherFromParams, 
    queryNotice, queryReport, queryVoucher, GraphqlOptions
} from "cartesi-client";

{% if has_ifaces -%}
import * as ifaces from "./ifaces";
{% endif %}


/**
 * Configs
 */

const ajv = new Ajv();
addFormats(ajv);
ajv.addFormat("biginteger", (data) => {
    return ethers.utils.isHexString(data) && data.length % 2 == 0;
});
const abiCoder = new ethers.utils.AbiCoder();
export const CONVENTIONAL_TYPES: Array<string> = ["bytes","hex","str","int","dict","list","tuple","json"];


/**
 * Models
 */

export enum IOType {
    report,
    notice,
    voucher,
    mutationPayload,
    queryPayload
}

interface ModelInterface<T> {
    ioType: IOType;
    abiTypes: Array<string>;
    params: Array<string>;
    decoder?(data: CartesiReport | CartesiNotice | CartesiVoucher | InspectReport): T;
    exporter?(data: T): string;
    validator: ValidateFunction<T>;
}

export interface Models {
    [key: string]: ModelInterface<any>;
};

export interface InspectReportInput {
    index?: number;
}
export interface InspectReport {
    payload: string;
    input?: InspectReportInput;
    index?: number;
}

export interface OutputGetters {
    [key: string]: (o?: GraphqlOptions) => Promise<CartesiReport>|Promise<CartesiNotice>|Promise<CartesiVoucher>;
}

export const outputGetters: OutputGetters = {
    report: queryReport,
    notice: queryNotice,
    voucher: queryVoucher
}

export class IOData<T extends object> {
    [key: string]: any;
    _model: ModelInterface<T>

    constructor(model: ModelInterface<T>, data: T, validate: boolean = true) {
        this._model = model;
        for (const key of this._model.params) {
            this[key] = (data as any)[key];
        }
        if (validate) this.validate();
    }

    get = (): T => {
        const data: any = {};
        for (const key of this._model.params) {
            data[key] = this[key];
        }
        return data;
    }

    validate = (): boolean => {
        const dataToValidate: any = { ...this.get() };
        for (const k of Object.keys(dataToValidate)) {
            if (ethers.BigNumber.isBigNumber(dataToValidate[k]))
                dataToValidate[k] = dataToValidate[k].toHexString();
        }
        if (!this._model.validator(dataToValidate))
            throw new Error(`Data does not implement interface: ${ajv.errorsText(this._model.validator.errors)}`);     
        return true;
    }

    export(): string {
        let payload: string;
        switch(this._model.ioType) {
            case IOType.mutationPayload: {
                // parametrize input to url
                const inputData: any = this.get();
                const paramList = Array<any>();
                for (const key of this._model.params) {
                    paramList.push(inputData[key]);
                }
                payload = abiCoder.encode(this._model.abiTypes,paramList);
                break;
            }
            case IOType.queryPayload: {
                // parametrize input to url
                const inputData: T = this.get();
                const paramList = Array<string>();
                for (const key in inputData) {
                    if (inputData[key] == undefined) continue;
                    if (Array.isArray(inputData[key])) {
                        for (const element in inputData[key]) {
                            paramList.push(`${key}=${inputData[key][element]}`);
                        }
                    } else {
                        paramList.push(`${key}=${inputData[key]}`);
                    }
                }
                payload = paramList.length > 0 ? `?${paramList.join('&')}` : "";
                break;
            }
            default: {
                throw new Error(`Invalid payload type ${this._model.ioType}`);
                // break;
            }
        }
        return payload;
    }
}

export class BasicOutput<T extends object> extends IOData<T> {
    _payload: string
    _inputIndex?: number
    _outputIndex?: number

    constructor(model: ModelInterface<T>, payload: string, inputIndex?: number, outputIndex?: number) {
        super(model,genericDecodeTo<T>(payload,model),false);
        this._inputIndex = inputIndex;
        this._outputIndex = outputIndex;
        this._payload = payload;
    }
}

export class Output<T extends object> extends BasicOutput<T>{
    constructor(model: ModelInterface<T>, report: CartesiReport | InspectReport) {
        super(model, report.payload, report.input?.index, report.index);
    }
}

export class OutputWithProof<T extends object> extends BasicOutput<T>{
    _proof: Maybe<Proof> | undefined
    _inputIndex: number
    _outputIndex: number
    
    constructor(model: ModelInterface<T>, payload: string, inputIndex: number, outputIndex: number, proof: Maybe<Proof> | undefined) {
        super(model, payload, inputIndex, outputIndex);
        this._inputIndex = inputIndex;
        this._outputIndex = outputIndex;
        this._proof = proof;
    }
}

export class Event<T extends object> extends OutputWithProof<T>{
    constructor(model: ModelInterface<T>, notice: CartesiNotice) {
        super(model, notice.payload, notice.input.index, notice.index, notice.proof);
    }
    validateOnchain = async (signer: Signer, dappAddress: string): Promise<boolean> => {
        if (this._proof == undefined)
            throw new Error("Notice has no proof");
        return await validateNoticeFromParams(signer,dappAddress,this._payload,this._proof);
    }
}

export class ContractCall<T extends object> extends OutputWithProof<T>{
    _destination: string
    constructor(model: ModelInterface<T>, voucher: CartesiVoucher) {
        super(model, voucher.payload, voucher.input.index, voucher.index, voucher.proof);
        this._destination = voucher.destination;
    }
    wasExecuted = async (signer: Signer, dappAddress: string): Promise<boolean> => {
        return await wasVoucherExecutedFromParams(signer,dappAddress,this._inputIndex,this._outputIndex);
    }
    execute = async (signer: Signer, dappAddress: string): Promise<ContractReceipt | null> => {
        if (this._proof == undefined)
            throw new Error("Voucher has no proof");
        return await executeVoucherFromParams(signer,dappAddress,this._destination,this._payload,this._proof);
    }
}


/*
 * Helpers
 */

// Advance
export async function genericAdvanceInput<T extends object>(
    client:Signer,
    dappAddress:string,
    selector:string,
    inputData: IOData<T>,
    options?:AdvanceInputOptions
):Promise<AdvanceOutput|ContractReceipt> {
    if (options == undefined) options = {};

    const payloadHex = inputData.export();
    const output = await advanceInput(client,dappAddress,selector + payloadHex.replace('0x',''),options).catch(
        e => {
            if (String(e.message).startsWith('0x'))
                throw new Error(ethers.utils.toUtf8String(e.message));
            throw new Error(e.message);
    });

    return output;
}

// Inspect
export async function inspectCall(
    payload:string,
    options:InspectOptions
):Promise<InspectReport> {
    options.decodeTo = "no-decode";
    const inspectResult: string = await inspect(payload,options).catch(
        e => {
            if (String(e.message).startsWith('0x'))
                throw new Error(ethers.utils.toUtf8String(e.message));
            throw new Error(e.message);
    }) as string; // hex string
    return {payload:inspectResult};
}

export async function genericInspect<T extends object>(
    inputData: IOData<T>,
    route: string,
    options?:InspectOptions
):Promise<InspectReport> {
    if (options == undefined) options = {};
    options.aggregate = true;
    const payload = `${route}${inputData.export()}`
    return await inspectCall(payload,options);
}

// Decode
export function genericDecodeTo<T extends object>(data: string,model: ModelInterface<T>): T {
    let dataObj: any;
    switch(model.ioType) {
        /*# case mutationPayload: {
            break;
        }
        case queryPayload: {
            break;
        }*/
        case IOType.report: {
            const dataStr = ethers.utils.toUtf8String(data);
            try {
                dataObj = JSON.parse(dataStr);
            } catch(e) {
                throw new Error(dataStr);
            }
            dataObj = JSON.parse(ethers.utils.toUtf8String(data));
            if (!model.validator(dataObj))
                throw new Error(`Data does not implement interface: ${ajv.errorsText(model.validator.errors)}`);     
            break;
        }
        case IOType.notice: {
            const dataValues = abiCoder.decode(model.abiTypes,data);
            dataObj = {};
            let ind = 0;
            for (const key of model.params) {
                dataObj[key] = dataValues[ind];
                ind++;
            }
            const dataToValidate = { ...dataObj };
            for (const k of Object.keys(dataToValidate)) {
                if (ethers.BigNumber.isBigNumber(dataToValidate[k]))
                    dataToValidate[k] = dataToValidate[k].toHexString();
            }
            if (!model.validator(dataToValidate))
                throw new Error(`Data does not implement interface: ${ajv.errorsText(model.validator.errors)}`);     
            
            break;
        }
        case IOType.voucher: {
            const abiTypes: Array<string> = ["bytes4"].concat(model.abiTypes);
            const dataValues = abiCoder.decode(abiTypes,data);
            dataObj = {};
            let ind = 0;
            for (const key of model.params) {
                if (ind == 0) continue; // skip selector
                dataObj[key] = dataValues[ind-1];
                ind++;
            }
            const dataToValidate = { ...dataObj };
            for (const k of Object.keys(dataToValidate)) {
                if (ethers.BigNumber.isBigNumber(dataToValidate[k]))
                    dataToValidate[k] = dataToValidate[k].toHexString();
            }
            if (!model.validator(dataToValidate))
                throw new Error(`Data does not implement interface: ${ajv.errorsText(model.validator.errors)}`);
            break;
        }
        default: {
            throw new Error(`Cannot convert ${model.ioType}`);
            // break;
        }
    }
    return dataObj;
}

export function decodeToConventionalTypes(data: string,modelName: string): any {
    if (!CONVENTIONAL_TYPES.includes(modelName))
        throw new Error(`Cannot decode to ${modelName}`);
    switch(modelName) {
        case "bytes": {
            if (typeof data == "string") {
                if (ethers.utils.isHexString(data))
                    return ethers.utils.arrayify(data);
                else
                    throw new Error(`Cannot decode to bytes`);
            }
            return data;
        }
        case "hex": {
            return data;
        }
        case "str": {
            return ethers.utils.toUtf8String(data);
        }
        case "int": {
            if (typeof data == "string") {
                if (ethers.utils.isHexString(data))
                    return parseInt(data, 16);
                else
                    throw new Error(`Cannot decode to int`);
            }
            if (ethers.utils.isBytes(data))
                return parseInt(ethers.utils.hexlify(data), 16);
            else
                throw new Error(`Cannot decode to int`);
        }
        case "dict" || "list" || "tuple": {
            return JSON.parse(ethers.utils.toUtf8String(data));
        }
    }
}

{% if add_indexer_query -%}
// indexer
export async function genericGetOutputs(
    inputData: ifaces.{{ indexer_query_info['model'].__name__ }},
    decoder: (data: CartesiReport | CartesiNotice | CartesiVoucher | InspectReport, modelName:string) => any,
    options?:InspectOptions
):Promise<any[]> {
    if (options == undefined) options = {};
    const indexerOutputRaw = await {{ convert_camel_case(indexer_query_info['method']) }}(inputData,options) as InspectReport;
    const indexerOutput: {{ indexer_output_info['model'].__name__ }} = decodeTo{{ indexer_output_info['model'].__name__ }}(indexerOutputRaw as CartesiReport);
    const graphqlQueries: Promise<any>[] = [];
    for (const outInd of indexerOutput.data) {
        const graphqlOptions: GraphqlOptions = {cartesiNodeUrl: options.cartesiNodeUrl, inputIndex: outInd.input_index, outputIndex: outInd.output_index};
        graphqlQueries.push(outputGetters[outInd.output_type](graphqlOptions).then(
            (output: CartesiReport | CartesiNotice | CartesiVoucher | InspectReport) => {
                return decoder(output,outInd.class_name);
            }
        ));
    }
    return Promise.all(graphqlQueries);
}
{% endif %}
'''

lib_imports = '''/* eslint-disable */
/**
 * This file was automatically generated by cartesapp.template_generator.
 * DO NOT MODIFY IT BY HAND. Instead, run the generator,
 */
import { ethers, Signer, ContractReceipt } from "ethers";
import Ajv from "ajv"
import addFormats from "ajv-formats"
import { keys } from 'ts-transformer-keys';

import { AdvanceOutput, AdvanceInputOptions, InspectOptions,
    Report as CartesiReport, Notice as CartesiNotice, Voucher as CartesiVoucher
} from "cartesi-client";

import { 
    genericAdvanceInput, genericDecodeTo, genericInspect, IOType, Models,
    IOData, Output, Event, ContractCall, InspectReport,
    CONVENTIONAL_TYPES, decodeToConventionalTypes{% if has_indexer_query -%}, genericGetOutputs{% endif %}
} from "../cartesapp/lib"

{% if has_indexer_query -%}
import * as cartesappIfaces from "../cartesapp/ifaces"
{% endif -%}

import * as ifaces from "./ifaces";


/**
 * Configs
 */

const ajv = new Ajv();
addFormats(ajv);
ajv.addFormat("biginteger", (data) => {
    return ethers.utils.isHexString(data) && data.length % 2 == 0;
});

'''
lib_template = '''
/*
 * Mutations/Advances
 */

{% for info in mutations_info -%}
export async function {{ convert_camel_case(info['method']) }}(
    client:Signer,
    dappAddress:string,
    inputData: ifaces.{{ info['model'].__name__ }},
    options?:AdvanceInputOptions
):Promise<AdvanceOutput|ContractReceipt> {
    const data: {{ info['model'].__name__ }} = new {{ info['model'].__name__ }}(inputData);
    return genericAdvanceInput<ifaces.{{ info['model'].__name__ }}>(client,dappAddress,'{{ "0x"+info["selector"].to_bytes().hex() }}',data, options);
}

{% endfor %}
/*
 * Queries/Inspects
 */

{% for info in queries_info -%}
export async function {{ convert_camel_case(info['method']) }}(
    inputData: ifaces.{{ info['model'].__name__ }},
    options?:InspectOptions
):Promise<InspectReport> {
    const route = '{{ info["selector"] }}';
    const data: {{ info['model'].__name__ }} = new {{ info['model'].__name__ }}(inputData);
    return genericInspect<ifaces.{{ info['model'].__name__ }}>(data,route,options);
}

{% endfor %}
{% if has_indexer_query -%}
/*
 * Indexer Query
 */

export async function getOutputs(
    inputData: cartesappIfaces.IndexerPayload,
    options?:InspectOptions
):Promise<any[]> {
    return genericGetOutputs(inputData,decodeToModel,options);
}
{% endif %}

/**
 * Models Decoders/Exporters
 */

export function decodeToModel(data: CartesiReport | CartesiNotice | CartesiVoucher | InspectReport, modelName: string): any {
    if (CONVENTIONAL_TYPES.includes(modelName))
        return decodeToConventionalTypes(data.payload,modelName);
    const decoder = models[modelName].decoder;
    if (decoder == undefined)
        throw new Error("undefined decoder");
    return decoder(data);
}

export function exportToModel(data: any, modelName: string): string {
    const exporter = models[modelName].exporter;
    if (exporter == undefined)
        throw new Error("undefined exporter");
    return exporter(data);
}

{% for info in mutations_payload_info -%}
export class {{ info['model'].__name__ }} extends IOData<ifaces.{{ info['model'].__name__ }}> { constructor(data: ifaces.{{ info["model"].__name__ }}, validate: boolean = true) { super(models['{{ info["model"].__name__ }}'],data,validate); } }
export function exportTo{{ info['model'].__name__ }}(data: ifaces.{{ info["model"].__name__ }}): string {
    const dataToExport: {{ info['model'].__name__ }} = new {{ info['model'].__name__ }}(data);
    return dataToExport.export();
}

{% endfor -%}
{% for info in queries_payload_info -%}
export class {{ info['model'].__name__ }} extends IOData<ifaces.{{ info['model'].__name__ }}> { constructor(data: ifaces.{{ info["model"].__name__ }}, validate: boolean = true) { super(models['{{ info["model"].__name__ }}'],data,validate); } }
export function exportTo{{ info['model'].__name__ }}(data: ifaces.{{ info["model"].__name__ }}): string {
    const dataToExport: {{ info['model'].__name__ }} = new {{ info['model'].__name__ }}(data);
    return dataToExport.export();
}

{% endfor -%}
{% for info in reports_info -%}
export class {{ info['class'] }} extends Output<ifaces.{{ info['class'] }}> { constructor(output: CartesiReport | InspectReport) { super(models['{{ info["class"] }}'],output); } }
export function decodeTo{{ info['class'] }}(output: CartesiReport | CartesiNotice | CartesiVoucher | InspectReport): {{ info['class'] }} {
    return new {{ info['class'] }}(output as CartesiReport);
}

{% endfor -%}
{% for info in notices_info -%}
export class {{ info['class'] }} extends Event<ifaces.{{ info['class'] }}> { constructor(output: CartesiNotice) { super(models['{{ info["class"] }}'],output); } }
export function decodeTo{{ info['class'] }}(output: CartesiReport | CartesiNotice | CartesiVoucher | InspectReport): {{ info['class'] }} {
    return new {{ info['class'] }}(output as CartesiNotice);
}

{% endfor -%}
{% for info in vouchers_info -%}
export class {{ info['class'] }} extends ConrtacCall<ifaces.{{ info['class'] }}> { constructor(output: CartesiVoucher) { super(models['{{ info["class"] }}'],output); } }
export function decodeTo{{ info['class'] }}(output: CartesiReport | CartesiNotice | CartesiVoucher | InspectReport): {{ info['class'] }} {
    return new {{ info['class'] }}(output as CartesiVoucher);
}

{% endfor %}
/**
 * Model
 */

export const models: Models = {
    {% for info in mutations_payload_info -%}
    '{{ info["model"].__name__ }}': {
        ioType:IOType.mutationPayload,
        abiTypes:{{ info['abi_types'] }},
        params:keys<ifaces.{{ info["model"].__name__ }}>(),
        exporter: exportTo{{ info["model"].__name__ }},
        validator: ajv.compile<ifaces.{{ info["model"].__name__ }}>(JSON.parse('{{ info["model"].schema_json() }}'))
    },
    {% endfor -%}
    {% for info in queries_payload_info -%}
    '{{ info["model"].__name__ }}': {
        ioType:IOType.queryPayload,
        abiTypes:{{ info['abi_types'] }},
        params:keys<ifaces.{{ info["model"].__name__ }}>(),
        exporter: exportTo{{ info["model"].__name__ }},
        validator: ajv.compile<ifaces.{{ info["model"].__name__ }}>(JSON.parse('{{ info["model"].schema_json() }}'))
    },
    {% endfor -%}
    {% for info in reports_info -%}
    '{{ info["class"] }}': {
        ioType:IOType.report,
        abiTypes:{{ info['abi_types'] }},
        params:keys<ifaces.{{ info["class"] }}>(),
        decoder: decodeTo{{ info['class'] }},
        validator: ajv.compile<ifaces.{{ info['class'] }}>(JSON.parse('{{ info["model"].schema_json() }}'))
    },
    {% endfor -%}
    {% for info in notices_info -%}
    '{{ info["class"] }}': {
        ioType:IOType.notice,
        abiTypes:{{ info['abi_types'] }},
        params:keys<ifaces.{{ info["class"] }}>(),
        decoder: decodeTo{{ info['class'] }},
        validator: ajv.compile<ifaces.{{ info['class'] }}>(JSON.parse('{{ info["model"].schema_json() }}'.replace('integer','string","format":"biginteger')))
    },
    {% endfor -%}
    {% for info in vouchers_info -%}
    '{{ info["class"] }}': {
        ioType:IOType.voucher,
        abiTypes:{{ info['abi_types'] }},
        params:keys<ifaces.{{ info["class"] }}>(),
        decoder: decodeTo{{ info['class'] }},
        validator: ajv.compile<ifaces.{{ info['class'] }}>(JSON.parse('{{ info["model"].schema_json() }}'.replace('integer','string","format":"biginteger')))
    },
    {% endfor -%}

};
'''