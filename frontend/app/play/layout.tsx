import { GameplayProvider } from "./GameplayContextProvider"


export default async function PlayLayout({
    children
  }: {
    children: React.ReactNode
  }) {


    return (
      <GameplayProvider>
        {children}
      </GameplayProvider>
    )
  }