const TToken = artifacts.require('TToken');
const TTokenFactory = artifacts.require('TTokenFactory');
const BFactory = artifacts.require('BFactory');
const BActions = artifacts.require('BActions');
const DSProxyFactory = artifacts.require('DSProxyFactory');
const DSProxy = artifacts.require('DSProxy');
const BPool = artifacts.require('BPool');

contract('BActions', async (accounts) => {
    const admin = accounts[0];
    const user1 = accounts[1];
    const { toHex } = web3.utils;
    const { toWei } = web3.utils;

    const MAX = web3.utils.toTwosComplement(-1);

    describe('Setup', () => {
        let factory;
        let FACTORY;
        let proxyFactory;
        let bactions;
        let BACTIONS;
        let tokens;
        let USER_PROXY;
        let userProxy;
        let dai; let mkr;
        let DAI; let MKR;

        before(async () => {
            proxyFactory = await DSProxyFactory.deployed();

            bactions = await BActions.deployed();
            BACTIONS = bactions.address;

            tokens = await TTokenFactory.deployed();
            factory = await BFactory.deployed();
            FACTORY = factory.address;

            await tokens.build(toHex('DAI'), toHex('DAI'), 18);
            await tokens.build(toHex('MKR'), toHex('MKR'), 18);

            DAI = await tokens.get.call(toHex('DAI'));
            MKR = await tokens.get.call(toHex('MKR'));

            dai = await TToken.at(DAI);
            mkr = await TToken.at(MKR);

            await dai.mint(admin, toWei('10000'));
            await mkr.mint(admin, toWei('20'));

            await dai.mint(user1, toWei('10000'));
            await mkr.mint(user1, toWei('20'));

            USER_PROXY = await proxyFactory.build.call();
            await proxyFactory.build();
            userProxy = await DSProxy.at(USER_PROXY);

            await dai.approve(USER_PROXY, MAX);
            await mkr.approve(USER_PROXY, MAX);
        });

        it('deploy pool through proxy', async () => {
            const createTokens = [DAI, MKR];
            const createBalances = [toWei('10'), toWei('1')];
            const createWeights = [toWei('5'), toWei('5')];
            const swapFee = toWei('0.03');
            const finalize = true;

            const createInterface = BActions.abi.find((iface) => iface.name === 'create');
            const params = [
                FACTORY,
                createTokens,
                createBalances,
                createWeights,
                swapFee,
                finalize,
            ];

            const functionCall = web3.eth.abi.encodeFunctionCall(createInterface, params);

            const poolAddress = await userProxy.methods['execute(address,bytes)'].call(
                BACTIONS, functionCall,
            );
            const POOL = `0x${poolAddress.slice(-40)}`;

            await userProxy.methods['execute(address,bytes)'](BACTIONS, functionCall);

            const bpool = await BPool.at(POOL);
            const controller = await bpool.getController();

            assert.equal(controller, USER_PROXY);
        });

        it('joinPool through proxy', async () => {
            const createTokens = [DAI, MKR];
            const createBalances = [toWei('10'), toWei('1')];
            const createWeights = [toWei('5'), toWei('5')];
            const swapFee = toWei('0.03');
            const finalize = true;

            const createInterface = BActions.abi.find((iface) => iface.name === 'create');
            let params = [
                FACTORY,
                createTokens,
                createBalances,
                createWeights,
                swapFee,
                finalize,
            ];

            const functionCall = web3.eth.abi.encodeFunctionCall(createInterface, params);

            const poolAddress = await userProxy.methods['execute(address,bytes)'].call(
                BACTIONS, functionCall,
            );
            const POOL = `0x${poolAddress.slice(-40)}`;
            await userProxy.methods['execute(address,bytes)'](BACTIONS, functionCall);

            params = [
                POOL,
                toWei('100'),
                [toWei('20'), toWei('2')],
            ];

            const functionSig = web3.eth.abi.encodeFunctionSignature('joinPool(address,uint256,uint256[])');
            const functionData = web3.eth.abi.encodeParameters(['address', 'uint256', 'uint256[]'], params);

            const argumentData = functionData.substring(2);
            const inputData = `${functionSig}${argumentData}`;

            await userProxy.methods['execute(address,bytes)'](BACTIONS, inputData);
        });
    });
});
