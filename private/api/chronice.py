# chronice: chronos + spice (but without chronos since spice-alone offered more controll)
# chronice.py <body> <target> <from_format> <time>
#     <from_format>: 'utc' or 'lmst' and will convert into the other
# !!! Currently only designed for Mars

# examples:
#        python chronice.py MARS MSL utc "2024-01-17T20:56:20.280"
#           => {"result": "SOL-04070M09:30:00"}
#        python chronice.py MARS MSL lmst "SOL-4070M09:30:00"
#           => {"result": "2024-01-17T20:56:20.279"}

import sys
import json
import os

import spiceypy

try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

def chronice(body, target, fromFormat, time):
    # Load kernels
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\','/')
    
    PATH_TO_KERNELS = '../../spice/kernels/'

    kernels_to_load = []
    try:
        # Crawl main dir for kernels
        path = PATH_TO_KERNELS
        for x in os.listdir(os.path.join(package_dir, path )):
            if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls')):
                kernels_to_load.append(path + x)
    except:
        pass

    try:
        # Crawl body dir for kernels
        path = PATH_TO_KERNELS + body + '/'
        for x in os.listdir(os.path.join(package_dir, path )):
            if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls')):
                kernels_to_load.append(path + x)
    except:
        pass

    try:
        # Crawl body/target dir for kernels
        path = PATH_TO_KERNELS + body + '/' + target + '/'
        for x in os.listdir(os.path.join(package_dir, path)):
            if x.endswith(('.bsp', '.tpc', '.tsc', '.tf', '.tls')):
                kernels_to_load.append(path + x)
    except:
        pass

    for k in kernels_to_load:
        spiceypy.furnsh( os.path.join(package_dir, k) )


    targetLow = target.lower()

    targetId = 0
    if targetLow == 'msl':
        targetId = -76900
    # LMST
    if fromFormat == 'utc':
        et = spiceypy.utc2et(time)
        result = spiceypy.sce2s(targetId, et)
        result = sclk2lmst(result, targetLow)
    else:
        time = lmst2sclk(time, targetLow)
        et = spiceypy.scs2e(targetId, time)
        result = spiceypy.et2utc(et, "ISOC", 3)

    return json.dumps({
        "result": result
    })

def sclk2lmst(sclk, target):
    if target == 'msl':
        s = sclk.split('/')[1].split(':')
        return f'SOL-{s[0]}M{s[1]}:{s[2]}:{s[3]}'
def lmst2sclk(lmst, target, partition = 1):
    if target == 'msl':
        s = lmst.replace(' ', ':').replace('-', ':').replace('M', ':').split(':')
        return f'{partition}/{s[1].zfill(5)}:{s[2].zfill(2)}:{s[3].zfill(2)}:{s[4].zfill(2)}:00000'

# Start
body = unquote(sys.argv[1])
target = unquote(sys.argv[2])
fromFormat = unquote(sys.argv[3])
time = unquote(sys.argv[4])

try:
    print(chronice(body, target, fromFormat, time))
except:
    print(json.dumps({"error": True, "message": 'Error: ' + str(sys.exc_info()[0])}))