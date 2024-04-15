import PlayPage from "../../../components/PlayPage";

export default async function PlayCartridge({ params }: { params: { cartridge_id: string } }) {
    return PlayPage({cartridge_id:params.cartridge_id})
}

