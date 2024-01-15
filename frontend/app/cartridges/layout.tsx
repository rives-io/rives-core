import { SelectedCartridgeProvider } from './selectedCartridgeProvider';

export default async function CartridgesLayout({
    children
  }: {
    children: React.ReactNode
  }) {

    return (
        <SelectedCartridgeProvider>
            {children}
        </SelectedCartridgeProvider>
    )
  }