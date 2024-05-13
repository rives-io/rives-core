import Image from 'next/image'
import YoutubeVideo from "./components/youtubeVideo";
import rivesLogo from '../public/rives64px.png';
import rivesPlay from '../public/rives-play.gif';


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

        <div className='w-11/12 my-12 h-1 rainbow-background'></div>

        <div className="flex items-center justify-center">
          <Image src={rivesPlay} height={300} alt='RiVES play'/>
        </div>

        <div className='grid grid-cols-1 gap-4'>
          <div className='grid grid-cols-4 text-center gap-2'>
            <div></div>
            <a className='my-4 btn' href={"/cartridges"}>
              Play
            </a>

            <a className='my-4 btn' href={"https://docs.rives.io"}>
              Docs
            </a>
          </div>

        </div>
        <div className='w-11/12 my-12 h-1 rainbow-background'></div>

        <div className='grid grid-cols-1 gap-4'>
          <h2 className='mt-6 text-xl text-center text-white'>
            Walkthrough
          </h2>
          <div className="flex items-center justify-center">
            <YoutubeVideo videoId="7y22pdgGIE0" />
          </div>
          <div></div>
        </div>

      </section>
      {/* <section id="statistical-section" className="h-svh">
        placeholder for statistical info retrieved from DApp
      </section> */}
    </main>
  )
}
