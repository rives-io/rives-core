import RivemuPlayer from '@/app/components/RivemuPlayer';
import { getTapeGif, getTapeImage } from "@/app/utils/util";


export async function generateMetadata({ params }: { params: { tape_id: string } }) {
    const img = await getTapeImage(params.tape_id);
    
    if (!img) return {};

    return {
        openGraph: {
          images: ["data:image/gif;base64,"+img],
        },
    }

}

export default async function Tape({ params }: { params: { tape_id: string } }) {
    return (
        <main className="flex items-center justify-center h-lvh">
            <RivemuPlayer tape_id={params.tape_id}/>
        </main>
    )
}
