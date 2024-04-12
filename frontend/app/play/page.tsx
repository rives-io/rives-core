import { fontPressStart2P } from "../utils/font"


export default function Play() {
    return (
      <main className="flex items-center justify-center h-lvh">
        <span className={`${fontPressStart2P.className} text-4xl text-white` }>Select a rule or cartridge!</span>
      </main>
    )
  }
