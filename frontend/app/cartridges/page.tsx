import CartridgesList from "../components/CartridgesList";
import CartridgeInfo from "../components/CartridgeInfo";
import { Suspense } from "react";
import RivesLogo from "../components/svg/RivesLogo";



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

export default async function Cartridges() {
    return (
      <main>
		<section className="py-16 my-8 w-full flex justify-center">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
				<Suspense fallback={listLoaderFallback()}>
					<CartridgesList />
				</Suspense>
			</div>

			<CartridgeInfo />
		</section>
      </main>
    )
  }
