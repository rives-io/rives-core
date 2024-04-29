import { redirect } from "next/navigation";
import { getSession, login, validateCodeForm } from "../../lib";
import AuthLoginForm from "../components/AuthLoginForm";


export default async function AuthPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="flex items-center justify-center h-lvh">
          <form
            action={async (formData) => {
              "use server";
              try {
                await validateCodeForm(formData);
                redirect("/");
              } catch (error) {
                console.log((error as Error).message);
              }
            }}
          className="flex flex-col items-center">
            <input className="p-2" type="text" name="code" maxLength={6} placeholder="Invite Code" />
            <br />
            <button type="submit" className="btn mt-4">Validate Code</button>
          </form>
      </main>
    )
  }


  return (
    <main className="flex items-center justify-center h-lvh">
        <AuthLoginForm session={session} loginFunction={login} />
    </main>
  )
}
