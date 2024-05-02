import { GameplayProvider } from "../play/GameplayContextProvider"
import React from 'react'

export default async function TapesLayout({
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