import { cache } from 'react';
import { cartridges as cartridgerequest} from "../backend-libs/core/lib";
import { envClient } from '../utils/clientEnv';
import CartridgeCard from './CartridgeCard';
import { CartridgeInfo } from '../backend-libs/core/ifaces';


const getCartridges = cache(async () => {
	const cartridges: any[] = (await cartridgerequest({},{decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache:"force-cache"})).data;

    return cartridges;
})

async function CartridgesList() {
    let cartridges:Array<CartridgeInfo> = await getCartridges();

    return (
        <>
            {
                cartridges.map((cartridge: any, index: number) => {
                    return (
                        <div key={index}>
                            <CartridgeCard cartridge={cartridge} />
                        </div>
                    );
                })
            }
        </>
    )
}


export default CartridgesList