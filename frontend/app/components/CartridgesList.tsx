"use client"


import { cache, useContext, useEffect, useState } from 'react';
import { cartridges as cartridgerequest} from "../backend-libs/core/lib";
import { envClient } from '../utils/clientEnv';
import CartridgeCard from './CartridgeCard';
import { CartridgeInfo } from '../backend-libs/core/ifaces';
import RivesLogo from "../components/svg/RivesLogo";
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';



interface CartridgesRequest {
    currentPage:number,
    pageSize:number,
    atEnd:boolean,
    fetching:boolean,
    requestedCartridgedFound:boolean,   // marks if the requested cartridge was found in one of the pages
    tgs?:string[],      // can be used to filter by cartridge tags
    authors?:string[]   // can be used to filter by cartridge authors
}


const getCartridges = cache(async (cartridgesRequestOptions:CartridgesRequest) => {
	const cartridges: any[] = (await cartridgerequest(
        {...cartridgesRequestOptions, get_cover: true },
        {decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL,cache:"force-cache"})
    ).data;

    return cartridges;
})

function listLoaderFallback() {
	const arr = Array.from(Array(8).keys());
	return (
		<>
            {
                arr.map((num, index) => {
                    return (
						<div key={index} className="w-48 h-64 grid grid-cols-1 p-2 bg-black animate-pulse">
							<RivesLogo className="place-self-start" style={{width:50}}/>
							<div className="w-fill h-36 bg-gray-500 relative"></div>
							<div className="place-self-end p-1 bg-gray-500 flex flex-col w-full h-16"></div>
						</div>
					)
                })
            }
        </>
	)
}

function CartridgesList({requestedCartridge}:{requestedCartridge?:CartridgeInfo}) {
    const [cartridges, setCartridges] = useState<Array<CartridgeInfo>|null>(requestedCartridge? [requestedCartridge]:null);
    const [cartridgesRequestOptions, setCartridgesRequestOptions] = useState<CartridgesRequest>(
        {currentPage: 1, pageSize: 10, requestedCartridgedFound: false, atEnd: false, fetching: false}
    );
    const {changeCartridge} = useContext(selectedCartridgeContext);


    useEffect(() => {
        const getFirstPage = async () => {
            await nextPage();

            // selects the requestedCartridge
            if (requestedCartridge) changeCartridge(requestedCartridge);
        }
    
        getFirstPage();
    }, [])

    async function nextPage() {
        if (cartridgesRequestOptions.fetching || cartridgesRequestOptions.atEnd) return;

        setCartridgesRequestOptions({...cartridgesRequestOptions, fetching: true});
        let newCartridges:Array<CartridgeInfo> = await getCartridges(cartridgesRequestOptions);
    
        // no more cartridges to get
        if (newCartridges.length == 0) {
            setCartridgesRequestOptions({...cartridgesRequestOptions, atEnd: true, fetching: false});
            return;
        }

        let found = cartridgesRequestOptions.requestedCartridgedFound;
        if (!found && requestedCartridge) {
            for (let i = 0; i < newCartridges.length; i++) {
                if (newCartridges[i].id.toLowerCase() == requestedCartridge.id.toLowerCase()) {
                    found = true;
                    newCartridges.splice(i,1); // remove cartridge "i" because it is the requestedCartridge
                    break;
                }
            }
        }

        if (cartridges) setCartridges([...cartridges, ...newCartridges]);
        else setCartridges(newCartridges);

        setCartridgesRequestOptions({...cartridgesRequestOptions, 
            currentPage: cartridgesRequestOptions.currentPage+1, 
            fetching: false,
            requestedCartridgedFound: found,
            atEnd: newCartridges.length < cartridgesRequestOptions.pageSize
        });
    }

    if (cartridgesRequestOptions.fetching || !cartridges || (requestedCartridge && cartridges?.length == 1)) {
        return listLoaderFallback();
    }

    if (cartridges.length == 0) {
        return "No cartridges Found!";
    }

    return (
        <>
            {
                cartridges?.map((cartridge: CartridgeInfo, index: number) => {
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