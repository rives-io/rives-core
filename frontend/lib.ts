"use server"


import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { useCode, validateCode } from "./app/utils/util";
import { envServer } from "./app/utils/serverEnv";
import { redirect } from "next/navigation";

const key = new TextEncoder().encode(envServer.INVITE_CODE_KEY);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function validateCodeForm(formData: FormData) {
    // Verify credentials && get the user
    const code = formData.get("code")

    const payload = {code: code}
    
    // Create the session
    const sessionCode = await encrypt(payload);

    const res = await validateCode(sessionCode);
    if (!res.success)  throw new Error(res.msg);

    // Save the session in a cookie
    cookies().set("session", sessionCode, { httpOnly: true });
}

export async function login(code: string, userAddress:string) {
    // Verify credentials && get the user
    const payload = {code: code, userAddress: userAddress}
    
    // Create the session
    const sessionCode = await encrypt(payload);

    const res = await useCode(sessionCode);
    if (!res.success)  throw new Error(res.msg);

    // Save the session in a cookie
    cookies().set("session", sessionCode, { httpOnly: true });

    redirect("/");
}

export async function getSession() {
  const session = cookies().get("session")?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  if (!session) return;

  // Refresh the session so it doesn't expire
  const parsed = await decrypt(session);
  parsed.expires = new Date(Date.now() + 10 * 1000);
  const res = NextResponse.next();
  res.cookies.set({
    name: "session",
    value: await encrypt(parsed),
    httpOnly: true,
    expires: parsed.expires,
  });
  return res;
}