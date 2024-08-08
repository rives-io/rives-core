import subprocess
import os
from pathlib import Path
import tempfile
import shutil

from .core_settings import CoreSettings, get_cartridges_path, is_inside_cm

def riv_get_cartridge_info(cartridge_filepath):
    args = ["sqfscat","-st"]
    args.append(cartridge_filepath)
    args.append("/info.json")
        
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode > 0:
        raise Exception(f"Error getting info: {str(result.stderr)}")

    return result.stdout

def riv_get_cover(cartridge_filepath):
    args = ["sqfscat","-no-exit"]
    args.append(cartridge_filepath)
    args.append("/cover.png")
        
    result = subprocess.run(args, capture_output=True)
    if result.returncode > 0:
        raise Exception(f"Error getting cover: {str(result.stderr)}")

    return result.stdout

def riv_get_cartridge_riv_version(cartridge_filepath):
    args = ["sqfscat","-st"]
    args.append(cartridge_filepath)
    args.append("/.riv")
        
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode > 0:
        raise Exception(f"Error getting info: {str(result.stderr)}")

    return result.stdout.strip()


def verify_log(cartridge_data: bytes, log: bytes,riv_args: str,in_card: bytes, entropy: str = None,
               frame: int =None,get_outhist=False,get_screenshot=False) -> dict[str,bytes]:
    if is_inside_cm(): # use riv os
        log_path = "/run/replaylog"
        outcard_path = "/run/outcard"
        incard_path = "/run/incard"
        outhash_path = "/run/outhash"
        screenshot_path = "/run/screenshot"
        outhist_path = "/run/outhist"
        rivos_cartridges_path = f"/{CoreSettings().cartridges_path}" # absolute cartridges path on rivos
        # data_cartridge_path = f"{get_cartridges_path()}/{cartridge_id}" # absolute data full cartridge path
        cartridge_path = f"/{CoreSettings().cartridges_path}/run_cartridge" #{cartridge_id}" # relative to rivos full cartridge path
        rivos_cartridge_path = f"{rivos_cartridges_path}/run_cartridge" #{cartridge_id}" # absolute full cartridge path on rivos
        
        if not os.path.exists(rivos_cartridges_path):
            os.makedirs(rivos_cartridges_path)

        # shutil.copy2(data_cartridge_path, rivos_cartridge_path)

        with open(rivos_cartridge_path,'wb') as cartridge_file:
            cartridge_file.write(cartridge_data)

        with open(log_path,'wb') as log_file:
            log_file.write(log)

        if os.path.exists(outcard_path): os.remove(outcard_path)
        if os.path.exists(outhist_path): os.remove(outhist_path)
        if os.path.exists(outhash_path): os.remove(outhash_path)
        if os.path.exists(screenshot_path): os.remove(screenshot_path)

        if in_card is not None and len(in_card) > 0:
            incard_file = open(incard_path,'wb')
            incard_file.write(in_card)
            incard_file.close()

        version = riv_get_cartridge_riv_version(rivos_cartridge_path)
        result = subprocess.run(["sh","/usr/sbin/riv-mount",version],capture_output=True)
        if result.returncode != 0:
            raise Exception(f"Error reading version: {str(result.stderr)}")

        result = subprocess.run(["ls","/rivos"],capture_output=True)
        
        run_args = []
        run_args.append("/rivos/usr/sbin/riv-chroot")
        run_args.append("/rivos")
        run_args.extend(["--setenv", "RIV_CARTRIDGE", cartridge_path])
        run_args.extend(["--setenv", "RIV_REPLAYLOG", log_path])
        run_args.extend(["--setenv", "RIV_OUTCARD", outcard_path])
        if get_outhist:
            run_args.extend(["--setenv", "RIV_OUTHIST", outhist_path])
        run_args.extend(["--setenv", "RIV_OUTHASH", outhash_path])
        if get_screenshot:
            run_args.extend(["--setenv", "RIV_SAVE_SCREENSHOT", screenshot_path])
        else:
            run_args.extend(["--setenv", "RIV_NO_YIELD", "y"])
        if in_card is not None and len(in_card) > 0:
            run_args.extend(["--setenv", "RIV_INCARD", incard_path])
        if frame is not None:
            run_args.extend(["--setenv", "RIV_STOP_FRAME", f"{frame}"])
        if entropy is not None:
            run_args.extend(["--setenv", "RIV_ENTROPY", f"{entropy}"])
        run_args.append("riv-run")
        if riv_args is not None and len(riv_args) > 0:
            run_args.extend(riv_args.split())
        result = subprocess.run(run_args)
        if result.returncode != 0:
            os.remove(log_path)
            os.remove(rivos_cartridge_path)
            raise Exception(f"Error processing log: {str(result.stderr)}")

        with open(outcard_path,'rb') as f:
            outcard_raw = f.read()
        os.remove(outcard_path)

        with open(outhash_path,'r') as f:
            outhash = bytes.fromhex(f.read())
        os.remove(outhash_path)

        screenshot = b''
        if os.path.exists(screenshot_path):
            with open(screenshot_path,'rb') as f: screenshot = f.read()
            os.remove(screenshot_path)

        outhist_raw = b''
        if os.path.exists(outhist_path):
            with open(outhist_path,'rb') as f: outhist_raw = f.read()
            os.remove(outhist_path)

        os.remove(log_path)
        os.remove(rivos_cartridge_path)

        result = subprocess.run(["sh","/usr/sbin/riv-umount"])
        if result.returncode != 0:
            raise Exception(f"Error reading version: {str(result.stderr)}")

        result = subprocess.run(["ls","/rivos"],capture_output=True)
        return {"outhist":outhist_raw, "outhash":outhash,"screenshot":screenshot,"outcard":outcard_raw}

    # use rivemu
    cartridge_temp = tempfile.NamedTemporaryFile()
    cartridge_file = cartridge_temp.file
    log_temp = tempfile.NamedTemporaryFile()
    log_file = log_temp.file
    incard_temp = tempfile.NamedTemporaryFile()
    incard_file = incard_temp.file
    outcard_temp = tempfile.NamedTemporaryFile()
    outhist_temp = tempfile.NamedTemporaryFile()
    outhash_temp = tempfile.NamedTemporaryFile(mode='w+')
    screenshot_temp = tempfile.NamedTemporaryFile()

    cartridge_file.write(cartridge_data)
    cartridge_file.flush()

    log_file.write(log)
    log_file.flush()
    
    if in_card is not None and len(in_card) > 0:
        incard_file.write(in_card)
        incard_file.flush()

    incard_path = len(in_card) > 0 and incard_temp.name or None

    absolute_cartridge_path = cartridge_temp.name # os.path.abspath(f"{get_cartridges_path()}/{cartridge_id}")

    version = riv_get_cartridge_riv_version(absolute_cartridge_path)
    
    rivemu_path = f"{CoreSettings().rivemu_path}-{version}"
    if not os.path.isabs(rivemu_path):
        rivemu_path = f"{os.getcwd()}/{rivemu_path}"
    if not os.path.isfile(rivemu_path):
        rivemu_path = CoreSettings().rivemu_path
        if not os.path.isabs(rivemu_path):
            rivemu_path = f"{os.getcwd()}/{rivemu_path}"

    run_args = []
    run_args.append(rivemu_path)
    run_args.append(f"-cartridge={absolute_cartridge_path}")
    run_args.append(f"-verify={log_temp.name}")
    run_args.append(f"-quiet")
    run_args.append(f"-save-outcard={outcard_temp.name}")
    run_args.append(f"-save-outhash={outhash_temp.name}")
    if get_outhist:
        run_args.append(f"-save-outhist={outhist_temp.name}")
    run_args.append(f"-no-window")
    if get_screenshot:
        run_args.append(f"-save-screenshot={screenshot_temp.name}")
    else:
        run_args.append(f"-no-yield")
    run_args.append(f"-no-audio")
    if in_card is not None and len(in_card):
        run_args.append(f"-load-incard={incard_temp.name}")
    if frame is not None:
        run_args.append(f"-stop-frame={frame}")
    if entropy is not None:
        run_args.append(f"-entropy={entropy}")
    if riv_args is not None and len(riv_args) > 0:
        run_args.append(f"-args={riv_args}")

    result = subprocess.run(run_args)
    if result.returncode != 0:
        log_temp.close()
        outcard_temp.close()
        incard_temp.close()
        outhash_temp.close()
        outhist_temp.close()
        screenshot_temp.close()
        raise Exception(f"Error processing log: {str(result.stderr)}")

    outcard_raw = outcard_temp.file.read()
    outhash = bytes.fromhex(outhash_temp.file.read())
    screenshot = screenshot_temp.file.read()
    outhist_raw = outhist_temp.file.read()

    cartridge_temp.close()
    log_temp.close()
    outcard_temp.close()
    incard_temp.close()
    outhash_temp.close()
    outhist_temp.close()
    screenshot_temp.close()

    return {"outhist":outhist_raw, "outhash":outhash,"screenshot":screenshot,"outcard":outcard_raw}

def install_riv_version(rivos_data: bytes):
    if is_inside_cm(): # use riv os
        rivos_version_path = tempfile.mktemp()

        rivos_sqfs_temp = tempfile.NamedTemporaryFile()
        rivos_sqfs_file = rivos_sqfs_temp.file

        rivos_sqfs_file.write(rivos_data)
        rivos_sqfs_file.flush()

        result = subprocess.run(["unsquashfs","-d",rivos_version_path,rivos_sqfs_temp.name])
        if result.returncode != 0:
            raise Exception(f"Error unsquashfsing: {str(result)}")
        
        result = subprocess.run(["sh",f"{rivos_version_path}/install.sh"])
        if result.returncode != 0:
            raise Exception(f"Error installing new version: {str(result)}")
        
        # rivos_versions=os.listdir(rivos_version_path)
        # for rivos_version in rivos_versions:
        #     shutil.copy2(os.path.join(rivos_version_path,rivos_version), "/")

        rivos_sqfs_temp.close()
        shutil.rmtree(rivos_version_path)
