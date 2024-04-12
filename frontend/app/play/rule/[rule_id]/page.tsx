import PlayPage from "../../../components/PlayPage";

export default async function Tape({ params }: { params: { rule_id: string } }) {
    return PlayPage({rule_id:params.rule_id})
}

