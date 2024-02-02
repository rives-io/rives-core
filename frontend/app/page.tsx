import Title from "./components/Title";
import YoutubeVideo from "./components/youtubeVideo";
import { fontPressStart2P } from './utils/font';


export default function Home() {
  return (
    <main className="">
      <section id="presentation-section" className="first-section">
          <Title />
          {/* <h2 className={`subtitle-text title-color my-4 ${fontPressStart2P.className}`}>RiSCV Verifiable Entertainment System</h2> */}
          <p className="my-6">
            <span className={fontPressStart2P.className}>RiVES</span> (RISC-V Verifiable Entertainment System) is a free and open source verifiable fantasy game console for making and playing small onchain games.
            All matches generate an output that can be used by anyone to reproduce and verify the gameplay.
            No more lying about that epic speedrun or completing the final stage without taking a hit.
            RIVES will enable decentralized trustless tournaments so that no one can deny your bounty after an epic play!
          </p>

          <div className="w-1/2 flex items-center justify-center">
            <YoutubeVideo videoId="7y22pdgGIE0" />
          </div>

      </section>
      {/* <section id="statistical-section" className="h-svh">
        placeholder for statistical info retrieved from DApp
      </section> */}
    </main>
  )
}
