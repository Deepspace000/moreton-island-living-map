# Procedural tileable textures: water normals + caustics, detail noise, cloud puffs.
import os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
rng = np.random.default_rng(7)
N = 512
def spectral(p, kmin=1, kmax=200, aniso=0.0, seed=0):
    r = np.random.default_rng(seed)
    kx = np.fft.fftfreq(N, 1 / N)[None, :]; ky = np.fft.fftfreq(N, 1 / N)[:, None]
    k = np.sqrt(kx ** 2 + ky ** 2); k[0, 0] = 1
    amp = k ** (-p) * (k >= kmin) * (k <= kmax)
    if aniso: amp = amp * (1 - aniso + aniso * (kx / k) ** 2)
    amp[0, 0] = 0
    f = amp * np.exp(2j * np.pi * r.random((N, N)))
    h = np.real(np.fft.ifft2(f))
    return (h - h.mean()) / h.std()
def n01(a): return (a - a.min()) / (a.max() - a.min())
# water: wind-sea height field -> normals (RG), caustics (B)
h = spectral(1.6, 3, 120, 0.55, 1)
gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)); gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0))
s = 2.2 / max(np.abs(gx).max(), np.abs(gy).max())
hc = spectral(1.9, 4, 40, 0, 5)
lap = ndi.laplace(hc, mode='wrap')
ca = 1 / np.clip(1 + 2.6 * lap / lap.std(), 0.12, None)
ca = ndi.gaussian_filter(ca, 0.8, mode='wrap'); ca = np.clip((ca - 0.45) / 3.2, 0, 1) ** 0.8
Image.fromarray((np.stack([np.clip(gx * s * .5 + .5, 0, 1), np.clip(gy * s * .5 + .5, 0, 1), ca], -1) * 255).astype(np.uint8)).save(f'{R}/water.png', optimize=True)
# noise: R broad fbm, G clumpy cellular (canopy), B fine grain
a = n01(spectral(1.5, 1, 64, 0, 11))
pts = rng.random((420, 2)) * N
yy, xx = np.mgrid[0:N, 0:N]
d = np.full((N, N), 1e9)
for px, py in pts:
    dx = np.abs(xx - px); dx = np.minimum(dx, N - dx); dy = np.abs(yy - py); dy = np.minimum(dy, N - dy)
    d = np.minimum(d, dx * dx + dy * dy)
cell = 1 - n01(np.sqrt(d)); cell = np.clip(cell * 1.15 - 0.08 + (n01(spectral(1.2, 8, 200, 0, 12)) - .5) * .25, 0, 1)
c = n01(spectral(0.9, 16, 256, 0, 13))
Image.fromarray((np.stack([a, cell, c], -1) * 255).astype(np.uint8)).save(f'{R}/noise.png', optimize=True)
# cloud puffs: 2x2 atlas, R = density, G = inner shading, B = wisp detail
A = np.zeros((N, N, 3)); M = N // 2
y, x = np.mgrid[0:M, 0:M]; rr = np.sqrt((x - M / 2 + .5) ** 2 + (y - M / 2 + .5) ** 2) / (M / 2)
for i in range(4):
    r = np.random.default_rng(100 + i)
    kx = np.fft.fftfreq(M, 1 / M)[None, :]; ky = np.fft.fftfreq(M, 1 / M)[:, None]; k = np.sqrt(kx ** 2 + ky ** 2); k[0, 0] = 1
    f = k ** (-1.7) * (k > 1.5) * np.exp(2j * np.pi * r.random((M, M))); nz = np.real(np.fft.ifft2(f)); nz = nz / nz.std()
    fall = np.clip(1 - rr, 0, 1)
    dens = np.clip(fall * 1.55 + nz * 0.24 * (0.35 + fall) - 0.30, 0, 1)
    dens = dens * np.clip((1 - rr) * 6, 0, 1)
    dens = dens ** 1.1
    f2 = k ** (-1.2) * (k > 4) * np.exp(2j * np.pi * r.random((M, M))); n2 = np.real(np.fft.ifft2(f2)); n2 = n01(n2)
    oy, ox = (i // 2) * M, (i % 2) * M
    A[oy:oy + M, ox:ox + M, 0] = dens
    A[oy:oy + M, ox:ox + M, 1] = n01(ndi.gaussian_filter(dens, 6) + nz * 0.05)
    A[oy:oy + M, ox:ox + M, 2] = n2
Image.fromarray((A * 255).astype(np.uint8)).save(f'{R}/puff.png', optimize=True)
for f in ('water.png', 'noise.png', 'puff.png'): print(f, os.path.getsize(f'{R}/{f}'))
