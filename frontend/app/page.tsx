import Image from 'next/image'
import YoutubeVideo from "./components/youtubeVideo";
import rivesLogo from '../public/rives64px.png';


export default function Home() {
  return (
    <main>
      <section id="presentation-section" className="first-section">
        <div className="flex space-x-2">
          <Image src={rivesLogo} alt='RiVES logo'/>
        </div>

        <div className=' max-w-[640px] text-center text-white'>
          <h2 className='mt-6 text-xl'>
            Rives is the World Arcade
          </h2>

          <p className="mt-6">
            Own cartridges, prove scores & contribute with infinite creativity
          </p>
        </div>

        <div className='w-11/12 my-16 h-1 rainbow-background'></div>

        <div className="flex items-center justify-center">
          <YoutubeVideo videoId="7y22pdgGIE0" />
        </div>

        <a className='mt-10 btn' href={"/cartridges"}>
          Start Playing
        </a>

      </section>
      {/* <section id="statistical-section" className="h-svh">
        placeholder for statistical info retrieved from DApp
      </section> */}
    </main>
  )
}
