import subprocess
import os
from pathlib import Path

from .setup import AppSettings


def riv_process_replay(cartridge_path,replay_path,outcard_path,incard_path):
    args = []
    if AppSettings.rivemu_path is None: # use riv os
        args.append("riv-chroot")
        args.append("/rivos")
        args.extend(["--setenv", "RIV_CARTRIDGE", f"/{cartridge_path}"])
        args.extend(["--setenv", "RIV_REPLAYLOG", replay_path])
        args.extend(["--setenv", "RIV_OUTCARD", outcard_path])
        if incard_path is not None:
            args.extend(["--setenv", "RIV_INCARD", incard_path])
        args.extend(["--setenv", "RIV_NO_YIELD", "y"])
        args.append("riv-run")
        return subprocess.run(args, capture_output=True, text=True)
    # use rivemu
    absolute_cartridge_path = os.path.abspath(cartridge_path)
    cwd=str(Path(AppSettings.rivemu_path).parent.parent.absolute())
    args.append(AppSettings.rivemu_path)
    args.append(f"-cartridge={absolute_cartridge_path}")
    args.append(f"-verify={replay_path}")
    # args.append(f"-save-outcard={outcard_path}")
    if incard_path is not None:
        args.append(f"-load-incard={incard_path}")
    args.append(f"-no-yield=y")
    p1 = subprocess.Popen(args,stdout=subprocess.PIPE, cwd=cwd)
    p2 = subprocess.Popen(["grep","-A1","==== BEGIN OUTCARD ===="],stdin=p1.stdout,stdout=subprocess.PIPE)

    fout = open(outcard_path, 'wb')

    return subprocess.run(["tail","-1"], stdin=p2.stdout,stdout=fout,stderr=subprocess.PIPE)

def riv_get_cartridge_info(cartridge_path):
    args = []
    if AppSettings.rivemu_path is None: # use riv os
        args.append("/rivos")
        args.extend(["sqfscat","-st",f"/{cartridge_path}"])
    else:
        args.extend(["sqfscat","-st",cartridge_path])
        
    return subprocess.run(args, capture_output=True, text=True)

def riv_get_cartridge_screenshot(cartridge_path,screenshot_path,frame):
    args = []
    if AppSettings.rivemu_path is None: # use riv os
        args.append("riv-chroot")
        args.append("/rivos")
        args.extend(["--setenv", "RIV_CARTRIDGE", f"/{cartridge_path}"])
        args.extend(["--setenv", "RIV_SAVE_SCREENSHOT", screenshot_path])
        args.extend(["--setenv", "RIV_STOP_FRAME", f"{frame}"])
        args.extend(["--setenv", "RIV_NO_YIELD", "y"])
        args.append("riv-run")
        return subprocess.run(args, capture_output=True, text=True)
    # use rivemu
    cwd=str(Path(AppSettings.rivemu_path).parent.parent.absolute())
    absolute_cartridge_path = os.path.abspath(cartridge_path)
    env = os.environ.copy()
    env['RIV_SAVE_SCREENSHOT'] = screenshot_path
    env['RIV_STOP_FRAME'] = f"{frame}"
    args.append(AppSettings.rivemu_path)
    args.append(f"-cartridge={absolute_cartridge_path}")
    args.append(f"-no-yield=y")

    return subprocess.run(args, capture_output=True, text=True, env=env,cwd=cwd)
