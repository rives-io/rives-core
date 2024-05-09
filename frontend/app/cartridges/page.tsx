import CartridgesList from "../components/CartridgesList";
import CartridgeInfo from "../components/CartridgeInfo";
import { envClient } from "../utils/clientEnv";
import { CartridgeInfo as Cartridge } from '../backend-libs/core/ifaces';
import { cartridgeInfo } from "@/app/backend-libs/core/lib";



export default async function Cartridges({searchParams}
:{searchParams?: { [key: string]: string | string[] | undefined };}) {
	const requestedCartridgeId = searchParams? searchParams["cartridge_id"]:null;
	let requestedCartridge:Cartridge|null = null;
	
	if (requestedCartridgeId && typeof requestedCartridgeId == "string") {
		requestedCartridge = await cartridgeInfo({id:requestedCartridgeId}, {decode:true, cartesiNodeUrl: envClient.CARTESI_NODE_URL, cache:"force-cache"});
	}
	
    return (
      <main>
		<section className="py-16 my-8 w-full flex justify-center">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
				{
					requestedCartridge?
						<CartridgesList requestedCartridge={requestedCartridge} />
					:
						<CartridgesList />
				}
			</div>

			<CartridgeInfo />
		</section>
      </main>
    )
  }
