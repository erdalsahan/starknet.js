import { AccountInterface } from '../account';
import {
  Abi,
  ArgsOrCalldataWithOptions,
  CairoAssembly,
  CompiledContract,
  ValidateType,
} from '../types';
import assert from '../utils/assert';
import { CallData } from '../utils/calldata';
import { Contract, getCalldata, splitArgsAndOptions } from './default';

export type CFParams = {
  compiledContract: CompiledContract;
  account: any;
  casm?: CairoAssembly;
  classHash?: string;
  compiledClassHash?: string;
  abi?: Abi;
};

export class ContractFactory {
  compiledContract: CompiledContract;

  account: AccountInterface;

  abi: Abi;

  classHash?: string;

  casm?: CairoAssembly;

  compiledClassHash?: string;

  private CallData: CallData;

  /**
   *
   * @param params CFParams
   *  - compiledContract: CompiledContract;
   *  - account: AccountInterface;
   *  - casm?: CairoAssembly;
   *  - classHash?: string;
   *  - compiledClassHash?: string;
   *  - abi?: Abi;
   */
  constructor(params: CFParams) {
    this.compiledContract = params.compiledContract;
    this.account = params.account;
    this.casm = params.casm;
    this.abi = params.abi ?? params.compiledContract.abi;
    this.classHash = params.classHash;
    this.compiledClassHash = params.compiledClassHash;
    this.CallData = new CallData(this.abi);
  }

  /**
   * Deploys contract and returns new instance of the Contract
   * If contract is not declared it will first declare it, and then deploy
   *
   * @param args - Array of the constructor arguments for deployment
   * @param options (optional) Object - parseRequest, parseResponse, addressSalt
   * @returns deployed Contract
   */
  public async deploy(...args: ArgsOrCalldataWithOptions): Promise<Contract> {
    const { args: param, options = { parseRequest: true } } = splitArgsAndOptions(args);

    const constructorCalldata = getCalldata(param, () => {
      if (options.parseRequest) {
        this.CallData.validate(ValidateType.DEPLOY, 'constructor', param);
        return this.CallData.compile('constructor', param);
      }
      // eslint-disable-next-line no-console
      console.warn('Call skipped parsing but provided rawArgs, possible malfunction request');
      return param;
    });

    const {
      deploy: { contract_address, transaction_hash },
    } = await this.account.declareAndDeploy({
      contract: this.compiledContract,
      casm: this.casm,
      classHash: this.classHash,
      compiledClassHash: this.compiledClassHash,
      constructorCalldata,
      salt: options.addressSalt,
    });
    assert(Boolean(contract_address), 'Deployment of the contract failed');

    const contractInstance = new Contract(
      this.compiledContract.abi,
      contract_address!,
      this.account
    );
    contractInstance.deployTransactionHash = transaction_hash;

    return contractInstance;
  }

  /**
   * Attaches to new Account
   *
   * @param account - new Provider or Account to attach to
   * @returns ContractFactory
   */
  connect(account: AccountInterface): ContractFactory {
    this.account = account;
    return this;
  }

  /**
   * Attaches current abi and account to the new address
   *
   * @param address - Contract address
   * @returns Contract
   */
  attach(address: string): Contract {
    return new Contract(this.abi, address, this.account);
  }

  // ethers.js' getDeployTransaction cant be supported as it requires the account or signer to return a signed transaction which is not possible with the current implementation
}
