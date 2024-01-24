"use client";

import { useEffect, useState } from "react";


import DarkIcon from "@/app/components/svg/DarkIcon";
import LightIcon from "@/app/components/svg/LightIcon";

const LIGHT_TRANSLATE = "-translate-x-2";
const LIGHT_BTN = "bg-yellow-500";

const DARK_TRANSLATE = "translate-x-full"
const DARK_BTN = "bg-gray-700"

type ThemeButton = {
    theme: string;
    translate: string;
    btnColor: string;
}

function setSiteTheme(theme:string) {
    document.documentElement.setAttribute("data-theme", theme);
}

function ThemeSwitch() {
    const [theme, setTheme] = useState<ThemeButton | null>(null);
    // set theme
    if (theme) setSiteTheme(theme.theme);


    // retrieve theme from localStorage
    useEffect(() => {
        if (window.localStorage.getItem("data-theme") == "light") {
            setTheme({
                theme: "light", "translate": LIGHT_TRANSLATE, "btnColor": LIGHT_BTN
            });
        } else {
            setTheme({
                theme: "dark", "translate": DARK_TRANSLATE, "btnColor": DARK_BTN
            });
        }
    }, [])


    const changeTheme = () => {
        if (theme?.theme! == "dark") {
            setTheme({
                theme: "light", "translate": LIGHT_TRANSLATE, "btnColor": LIGHT_BTN
            });
            window.localStorage.setItem("data-theme", "light");
        } else {
            setTheme({
                theme: "dark", "translate": DARK_TRANSLATE, "btnColor": DARK_BTN
            });
            window.localStorage.setItem("data-theme", "dark");
        }
    }


    return (
        <button onClick={changeTheme}
        className="w-16 h-8 rounded-full bg-white flex items-center transition duration-300 focus:outline-none shadow">
            <div
                className={`w-10 h-10 relative rounded-full transition duration-500 transform ${theme?.btnColor!} ${theme?.translate!} p-1 text-white`}>
                {
                    theme?.theme! == "light"?
                        <LightIcon />
                    :
                        <DarkIcon />
                }
            </div>
        </button>
    )
}

export default ThemeSwitch