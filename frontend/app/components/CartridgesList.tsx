import CartridgeSelectButton from './CartridgeSelectButton';
import { cache } from 'react';
import { cartridges as cartridgerequest} from "../backend-libs/app/lib";
import { envClient } from '../utils/clientEnv';


const getCartridges = cache(async () => {
	const cartridges: any[] = (await cartridgerequest({},{decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache:"force-cache"})).data;

    return cartridges;
  })

async function CartridgesList() {
    let cartridges = await getCartridges();

    return (
        <ul className='games-list'>
            {
                cartridges.map((cartridge: any, index: number) => {
                    return (
                        <li key={index}>
                            <CartridgeSelectButton index={index} cartridge={cartridge} />
                        </li>
                    );
                })
            }
        </ul>
    )
}


export default CartridgesList