"use server"

import { cookies } from "next/headers";

export const getCookieTheme = async () => {
    const cookieStore = cookies()
    const storedTheme = cookieStore.get('theme');

    if (!storedTheme) return null;

    return storedTheme.value;
}

export const setCookieTheme = async (theme:string) => {
    const cookieStore = cookies()
    cookieStore.set('theme', theme);
}