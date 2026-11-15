// Brachial plexus (right, anterior view) on real Z-Anatomy anatomy.
(function () {
  // Z-Anatomy nerve and artery centre lines (cm, sagittal frame: +x patient left, +y up, +z anterior).
  var CL = {
    C5: [[-1.34,148.98,-1.59],[-1.68,148.81,-1.48],[-2.02,148.62,-1.4],[-2.36,148.43,-1.31],[-2.7,148.22,-1.23],[-3.02,147.99,-1.17],[-3.3,147.72,-1.18],[-3.57,147.43,-1.2],[-3.84,147.13,-1.21],[-4.11,146.84,-1.23],[-4.37,146.53,-1.24],[-4.64,146.24,-1.25],[-4.9,145.93,-1.26],[-5.16,145.63,-1.28],[-5.42,145.33,-1.3]],
    C6: [[-1.73,147.31,-1.68],[-2.03,147.09,-1.59],[-2.33,146.85,-1.52],[-2.64,146.63,-1.46],[-2.97,146.44,-1.42],[-3.3,146.26,-1.38],[-3.65,146.09,-1.35],[-4.0,145.93,-1.34],[-4.36,145.78,-1.33],[-4.71,145.64,-1.32],[-5.07,145.48,-1.31],[-5.42,145.33,-1.3]],
    C7: [[-1.55,145.83,-2.27],[-1.91,145.63,-2.2],[-2.27,145.45,-2.12],[-2.64,145.27,-2.05],[-3.0,145.08,-1.96],[-3.37,144.9,-1.99],[-3.74,144.75,-2.09],[-4.11,144.61,-2.22],[-4.48,144.47,-2.36],[-4.85,144.33,-2.49],[-5.22,144.18,-2.58]],
    C8: [[-1.44,144.85,-2.85],[-1.78,144.67,-2.79],[-2.13,144.5,-2.72],[-2.45,144.31,-2.6],[-2.74,144.09,-2.46],[-3.01,143.86,-2.29],[-3.33,143.7,-2.13],[-3.68,143.61,-1.97],[-4.04,143.57,-1.82],[-4.41,143.58,-1.68],[-4.78,143.61,-1.55],[-5.15,143.63,-1.43],[-5.52,143.58,-1.32]],
    T1: [[-1.39,143.45,-3.47],[-1.78,143.37,-3.42],[-2.17,143.39,-3.38],[-2.55,143.47,-3.3],[-2.93,143.49,-3.16],[-3.27,143.5,-2.97],[-3.59,143.52,-2.73],[-3.91,143.53,-2.49],[-4.24,143.54,-2.27],[-4.56,143.55,-2.04],[-4.88,143.56,-1.8],[-5.2,143.57,-1.55],[-5.52,143.58,-1.32]],
    ut: [[-5.42,145.33,-1.3],[-5.67,145.03,-1.35],[-5.92,144.74,-1.43],[-6.18,144.46,-1.54],[-6.45,144.21,-1.68],[-6.7,143.96,-1.86],[-6.96,143.74,-2.05],[-7.22,143.51,-2.24],[-7.48,143.28,-2.42],[-7.75,143.03,-2.57],[-8.01,142.75,-2.66],[-8.27,142.46,-2.72],[-8.52,142.15,-2.74],[-8.76,141.84,-2.74]],
    mt: [[-5.22,144.18,-2.58],[-5.57,144.0,-2.57],[-5.9,143.8,-2.56],[-6.23,143.58,-2.56],[-6.55,143.35,-2.56],[-6.86,143.11,-2.55],[-7.17,142.86,-2.54],[-7.48,142.62,-2.52],[-7.78,142.38,-2.48],[-8.1,142.15,-2.42],[-8.41,141.93,-2.33]],
    lt: [[-5.52,143.58,-1.32],[-5.87,143.44,-1.23],[-6.22,143.29,-1.16],[-6.56,143.1,-1.16],[-6.88,142.88,-1.2],[-7.18,142.64,-1.27],[-7.47,142.4,-1.37],[-7.75,142.15,-1.48],[-8.03,141.9,-1.58],[-8.34,141.67,-1.63]],
    ad_u: [[-8.76,141.84,-2.74],[-8.96,141.6,-2.73],[-9.16,141.37,-2.71],[-9.36,141.14,-2.67],[-9.56,140.91,-2.6],[-9.77,140.71,-2.5],[-9.98,140.54,-2.35],[-10.19,140.41,-2.16],[-10.38,140.31,-1.95],[-10.57,140.23,-1.72],[-10.79,140.12,-1.53],[-11.03,139.95,-1.45]],
    ad_m: [[-8.41,141.93,-2.33],[-8.66,141.76,-2.24],[-8.9,141.59,-2.15],[-9.15,141.42,-2.05],[-9.38,141.25,-1.95],[-9.62,141.07,-1.84],[-9.86,140.88,-1.74],[-10.09,140.7,-1.65],[-10.33,140.51,-1.57],[-10.57,140.33,-1.51],[-10.81,140.13,-1.46],[-11.05,139.93,-1.44]],
    ad_l: [[-8.34,141.67,-1.63],[-8.53,141.46,-1.59],[-8.73,141.24,-1.59],[-8.92,141.04,-1.58],[-9.13,140.83,-1.54],[-9.32,140.63,-1.48],[-9.52,140.44,-1.39],[-9.71,140.26,-1.27],[-9.89,140.09,-1.13],[-10.09,139.91,-1.01]],
    pd_u: [[-8.76,141.84,-2.74],[-8.93,141.61,-2.72],[-9.08,141.36,-2.7],[-9.22,141.11,-2.69],[-9.35,140.85,-2.68],[-9.5,140.6,-2.66],[-9.68,140.37,-2.64],[-9.86,140.15,-2.64],[-10.07,139.95,-2.63]],
    pd_m: [[-8.41,141.93,-2.33],[-8.64,141.75,-2.28],[-8.84,141.54,-2.28],[-9.02,141.32,-2.32],[-9.19,141.09,-2.39],[-9.35,140.85,-2.46],[-9.5,140.61,-2.53],[-9.67,140.38,-2.59],[-9.86,140.16,-2.63],[-10.07,139.95,-2.63]],
    pd_l: [[-8.34,141.67,-1.63],[-8.59,141.52,-1.61],[-8.84,141.37,-1.6],[-9.08,141.22,-1.58],[-9.33,141.07,-1.56],[-9.57,140.91,-1.55],[-9.82,140.77,-1.52],[-10.07,140.62,-1.5],[-10.31,140.46,-1.48],[-10.55,140.31,-1.45],[-10.8,140.16,-1.43],[-11.04,140.0,-1.4]],
    pc: [[-10.07,139.95,-2.63],[-10.37,139.65,-2.62],[-10.67,139.36,-2.62],[-10.96,139.07,-2.61],[-11.26,138.78,-2.6],[-11.56,138.49,-2.59],[-11.86,138.2,-2.58],[-12.16,137.91,-2.57]],
    ax: [[-11.05,139.93,-1.44],[-11.41,139.64,-1.38],[-11.68,139.27,-1.54],[-11.96,138.91,-1.71],[-12.28,138.54,-1.8],[-12.59,138.18,-1.87],[-12.91,137.81,-1.92],[-13.23,137.44,-1.98],[-13.55,137.07,-2.06],[-13.87,136.72,-2.16],[-14.19,136.38,-2.29],[-14.5,136.05,-2.47],[-14.81,135.76,-2.72],[-15.14,135.52,-2.99],[-15.53,135.34,-3.23],[-15.93,135.21,-3.48],[-16.33,135.07,-3.72]],
    rad: [[-12.16,137.91,-2.57],[-12.55,137.46,-2.53],[-12.94,137.02,-2.45],[-13.34,136.58,-2.36],[-13.73,136.13,-2.34],[-14.09,135.66,-2.41],[-14.44,135.2,-2.54],[-14.79,134.74,-2.68],[-15.16,134.29,-2.84],[-15.52,133.84,-2.99],[-15.88,133.39,-3.14],[-16.23,132.94,-3.29],[-16.58,132.47,-3.43],[-16.92,132.0,-3.57],[-17.24,131.52,-3.7],[-17.56,131.02,-3.81],[-17.86,130.52,-3.92],[-18.14,130.0,-4.02],[-18.4,129.47,-4.11],[-18.63,128.93,-4.19],[-18.85,128.38,-4.25],[-19.06,127.82,-4.3],[-19.26,127.26,-4.35],[-19.47,126.7,-4.4],[-19.69,126.15,-4.44],[-19.91,125.59,-4.49],[-20.12,125.04,-4.56],[-20.33,124.48,-4.61],[-20.54,123.93,-4.65],[-20.76,123.38,-4.68],[-21.0,122.83,-4.67],[-21.25,122.29,-4.63],[-21.51,121.75,-4.58],[-21.79,121.23,-4.51],[-22.08,120.72,-4.42],[-22.38,120.21,-4.3],[-22.66,119.7,-4.17],[-22.92,119.19,-4.02],[-23.16,118.66,-3.87],[-23.37,118.13,-3.7],[-23.57,117.6,-3.52],[-23.75,117.07,-3.31],[-23.91,116.55,-3.07],[-24.06,116.02,-2.82],[-24.17,115.49,-2.58],[-24.25,114.95,-2.35],[-24.3,114.39,-2.15],[-24.33,113.81,-1.99],[-24.3,113.23,-1.87],[-24.22,112.64,-1.8],[-24.1,112.06,-1.76],[-23.95,111.48,-1.74],[-23.8,110.91,-1.72],[-23.64,110.33,-1.71],[-23.5,109.75,-1.69],[-23.37,109.17,-1.65]],
    mcn: [[-17.54,131.04,-0.85],[-17.83,130.52,-0.94],[-18.12,130.0,-1.02],[-18.42,129.48,-1.1],[-18.72,128.97,-1.18],[-19.02,128.45,-1.26],[-19.29,127.92,-1.35],[-19.54,127.38,-1.44],[-19.77,126.83,-1.53],[-19.99,126.28,-1.63],[-20.18,125.71,-1.74],[-20.35,125.15,-1.85],[-20.48,124.57,-1.98],[-20.6,123.99,-2.07],[-20.72,123.41,-2.17],[-20.81,122.82,-2.25],[-20.9,122.23,-2.34],[-20.98,121.64,-2.43],[-21.04,121.04,-2.52],[-21.1,120.45,-2.6],[-21.14,119.85,-2.66],[-21.19,119.25,-2.72],[-21.23,118.65,-2.74],[-21.28,118.05,-2.75],[-21.35,117.45,-2.73],[-21.41,116.86,-2.7],[-21.47,116.26,-2.62],[-21.54,115.67,-2.53],[-21.6,115.08,-2.4],[-21.66,114.5,-2.27],[-21.73,113.92,-2.14],[-21.8,113.33,-2.02],[-21.87,112.74,-1.92],[-21.94,112.14,-1.85],[-21.97,111.54,-1.83],[-22.0,110.94,-1.83],[-22.05,110.34,-1.83],[-22.15,109.75,-1.79],[-22.32,109.18,-1.69]],
    med: [[-11.11,138.93,-2.6],[-11.56,138.58,-2.43],[-12.02,138.25,-2.23],[-12.49,137.93,-2.03],[-12.96,137.63,-1.82],[-13.44,137.32,-1.61],[-13.9,137.0,-1.41],[-14.36,136.65,-1.24],[-14.79,136.26,-1.08],[-15.2,135.84,-0.96],[-15.57,135.38,-0.87],[-15.91,134.9,-0.81],[-16.23,134.39,-0.79],[-16.5,133.85,-0.81],[-16.72,133.3,-0.86],[-16.89,132.73,-0.95],[-17.05,132.16,-1.05],[-17.2,131.59,-1.15],[-17.35,131.02,-1.24],[-17.51,130.44,-1.32],[-17.65,129.87,-1.41],[-17.78,129.29,-1.52],[-17.89,128.71,-1.62],[-17.99,128.13,-1.73],[-18.08,127.55,-1.85],[-18.15,126.96,-1.96],[-18.22,126.38,-2.07],[-18.28,125.79,-2.18],[-18.34,125.21,-2.29],[-18.36,124.62,-2.41],[-18.37,124.03,-2.49],[-18.38,123.43,-2.52],[-18.39,122.83,-2.52],[-18.39,122.23,-2.49],[-18.37,121.63,-2.45],[-18.34,121.03,-2.42],[-18.29,120.44,-2.37],[-18.22,119.84,-2.32],[-18.15,119.25,-2.25],[-18.12,118.66,-2.18],[-18.14,118.06,-2.1],[-18.19,117.47,-2.02],[-18.28,116.89,-1.93],[-18.4,116.31,-1.82],[-18.56,115.74,-1.71],[-18.75,115.18,-1.59],[-18.95,114.63,-1.5],[-19.16,114.07,-1.43],[-19.37,113.51,-1.38],[-19.62,112.97,-1.37],[-19.89,112.43,-1.38],[-20.16,111.89,-1.37],[-20.43,111.36,-1.36],[-20.72,110.84,-1.34],[-21.01,110.31,-1.31],[-21.28,109.78,-1.3],[-21.53,109.23,-1.29],[-21.78,108.69,-1.28],[-22.03,108.14,-1.28],[-22.25,107.59,-1.29],[-22.42,107.01,-1.3],[-22.53,106.42,-1.33],[-22.54,105.83,-1.39],[-22.47,105.24,-1.45],[-22.4,104.64,-1.43],[-22.3,104.05,-1.37],[-22.2,103.47,-1.25],[-22.12,102.9,-1.11],[-22.05,102.33,-0.94],[-22.05,101.76,-0.75],[-22.12,101.21,-0.52],[-22.24,100.66,-0.3],[-22.33,100.11,-0.1],[-22.4,99.54,0.07],[-22.48,98.96,0.23],[-22.58,98.39,0.37],[-22.71,97.82,0.5],[-22.87,97.25,0.62],[-23.06,96.69,0.72],[-23.26,96.14,0.81],[-23.47,95.58,0.9],[-23.68,95.02,0.98],[-23.87,94.46,1.08],[-24.04,93.9,1.19],[-24.2,93.33,1.3],[-24.35,92.76,1.42],[-24.49,92.2,1.54],[-24.63,91.63,1.67],[-24.76,91.05,1.8],[-24.88,90.48,1.93],[-25.01,89.91,2.06],[-25.12,89.34,2.19],[-25.24,88.76,2.32],[-25.36,88.19,2.45],[-25.48,87.62,2.58],[-25.61,87.04,2.71],[-25.73,86.47,2.83],[-25.86,85.9,2.95],[-25.98,85.32,3.07],[-26.11,84.75,3.19],[-26.23,84.18,3.31],[-26.35,83.6,3.43]],
    uln: [[-10.09,139.91,-1.01],[-10.5,139.5,-0.86],[-10.91,139.07,-0.77],[-11.31,138.63,-0.73],[-11.71,138.18,-0.71],[-12.11,137.74,-0.7],[-12.51,137.29,-0.69],[-12.92,136.85,-0.69],[-13.34,136.42,-0.68],[-13.77,136.01,-0.65],[-14.2,135.59,-0.65],[-14.6,135.14,-0.69],[-14.97,134.68,-0.76],[-15.31,134.19,-0.85],[-15.64,133.7,-0.94],[-15.96,133.2,-1.04],[-16.26,132.69,-1.14],[-16.54,132.17,-1.24],[-16.81,131.65,-1.35],[-17.05,131.11,-1.45],[-17.27,130.56,-1.55],[-17.46,130.0,-1.64],[-17.63,129.43,-1.75],[-17.76,128.86,-1.85],[-17.86,128.28,-1.96],[-17.93,127.69,-2.07],[-17.98,127.1,-2.17],[-18.03,126.51,-2.28],[-18.07,125.93,-2.38],[-18.11,125.34,-2.49],[-18.13,124.75,-2.59],[-18.14,124.16,-2.7],[-18.13,123.57,-2.81],[-18.1,122.98,-2.92],[-18.06,122.39,-3.03],[-18.02,121.8,-3.14],[-17.97,121.21,-3.24],[-17.93,120.62,-3.34],[-17.89,120.03,-3.44],[-17.87,119.44,-3.53],[-17.86,118.85,-3.61],[-17.86,118.25,-3.68],[-17.88,117.66,-3.76],[-17.9,117.06,-3.84],[-17.93,116.47,-3.92],[-17.97,115.88,-4.0],[-18.0,115.28,-4.08],[-18.04,114.69,-4.16],[-18.1,114.1,-4.23],[-18.15,113.5,-4.29],[-18.2,112.91,-4.33],[-18.26,112.31,-4.36],[-18.31,111.71,-4.38],[-18.37,111.12,-4.38],[-18.42,110.52,-4.37],[-18.47,109.92,-4.35],[-18.52,109.32,-4.31],[-18.57,108.73,-4.25],[-18.61,108.14,-4.18],[-18.66,107.55,-4.09],[-18.71,106.96,-3.97],[-18.76,106.37,-3.85],[-18.83,105.79,-3.73],[-18.89,105.21,-3.59],[-18.97,104.63,-3.46],[-19.04,104.05,-3.33],[-19.11,103.47,-3.19],[-19.19,102.9,-3.04],[-19.27,102.32,-2.88],[-19.35,101.75,-2.71],[-19.45,101.19,-2.54],[-19.56,100.63,-2.37],[-19.69,100.06,-2.19],[-19.82,99.5,-2.03],[-19.96,98.94,-1.87],[-20.11,98.38,-1.72],[-20.27,97.82,-1.57],[-20.44,97.27,-1.42],[-20.63,96.72,-1.27],[-20.82,96.17,-1.11],[-21.0,95.63,-0.93],[-21.2,95.11,-0.72],[-21.4,94.59,-0.49],[-21.6,94.08,-0.24],[-21.8,93.62,0.08],[-22.02,93.17,0.42],[-22.23,92.7,0.71],[-22.45,92.19,0.94],[-22.68,91.65,1.09],[-22.9,91.11,1.19],[-23.1,90.55,1.29],[-23.28,89.99,1.41],[-23.44,89.44,1.57],[-23.56,88.87,1.73],[-23.69,88.31,1.89]],
    ltn: [[-2.7,148.22,-1.23],[-3.07,147.82,-1.45],[-3.16,147.4,-1.86],[-3.27,146.93,-2.21],[-3.49,146.41,-2.45],[-3.69,145.88,-2.64],[-3.92,145.34,-2.76],[-4.2,144.8,-2.77],[-4.52,144.31,-2.65],[-4.87,143.87,-2.44],[-5.22,143.5,-2.12],[-5.57,143.19,-1.74],[-5.93,142.9,-1.35],[-6.31,142.6,-0.98],[-6.7,142.27,-0.66],[-7.1,141.91,-0.37],[-7.5,141.59,-0.07],[-7.92,141.25,0.21],[-8.36,140.89,0.4],[-8.82,140.5,0.49],[-9.27,140.11,0.45],[-9.69,139.74,0.24],[-10.08,139.38,-0.05],[-10.45,138.96,-0.28],[-10.79,138.49,-0.43],[-11.12,137.99,-0.56],[-11.42,137.48,-0.66],[-11.7,136.95,-0.76],[-11.97,136.42,-0.86],[-12.23,135.89,-0.97],[-12.49,135.36,-1.1],[-12.76,134.84,-1.23],[-13.02,134.31,-1.37],[-13.25,133.77,-1.52],[-13.46,133.23,-1.67],[-13.63,132.68,-1.84],[-13.8,132.13,-2.02],[-13.97,131.58,-2.22],[-14.1,131.02,-2.41],[-14.2,130.46,-2.61],[-14.27,129.89,-2.8],[-14.3,129.32,-2.98],[-14.31,128.74,-3.15],[-14.27,128.16,-3.31],[-14.17,127.58,-3.46],[-14.07,127.0,-3.6],[-13.97,126.43,-3.74],[-13.86,125.85,-3.87],[-13.73,125.27,-4.0],[-13.61,124.69,-4.13],[-13.53,124.11,-4.27],[-13.48,123.54,-4.44],[-13.42,122.96,-4.61],[-13.35,122.38,-4.75],[-13.23,121.8,-4.85],[-13.09,121.22,-4.95],[-12.98,120.64,-5.09],[-12.86,120.08,-5.27],[-12.75,119.51,-5.44]],
    ltn2: [[-2.32,147.03,-1.68],[-2.57,146.98,-1.82],[-2.81,146.94,-1.97],[-3.05,146.9,-2.11],[-3.3,146.85,-2.25]],
    ss: [[-5.42,145.33,-1.3],[-5.69,144.94,-1.44],[-5.95,144.54,-1.57],[-6.22,144.17,-1.73],[-6.5,143.82,-1.93],[-6.79,143.49,-2.16],[-7.06,143.18,-2.43],[-7.35,142.88,-2.7],[-7.65,142.58,-2.96],[-7.95,142.28,-3.2],[-8.26,141.96,-3.41],[-8.56,141.62,-3.59],[-8.86,141.27,-3.77],[-9.14,140.9,-3.93],[-9.44,140.53,-4.07],[-9.75,140.16,-4.2],[-10.07,139.82,-4.33],[-10.43,139.51,-4.46],[-10.82,139.24,-4.59],[-11.23,139.0,-4.73],[-11.69,138.86,-4.85],[-12.17,138.82,-4.94],[-12.65,138.81,-5.05],[-13.11,138.73,-5.19],[-13.57,138.64,-5.35],[-14.02,138.52,-5.52],[-14.27,138.24,-5.81],[-14.17,137.87,-6.1],[-13.8,137.58,-6.24],[-13.37,137.36,-6.35],[-12.98,137.11,-6.51],[-12.65,136.82,-6.73],[-12.33,136.53,-6.97],[-12.02,136.25,-7.23],[-11.71,135.97,-7.49],[-11.4,135.69,-7.75]],
    sradial: [[-23.37,109.17,-1.65],[-23.44,108.51,-1.2],[-23.5,107.87,-0.71],[-23.58,107.19,-0.28],[-23.7,106.45,0.02],[-23.84,105.67,0.18],[-24.01,104.88,0.21],[-24.21,104.1,0.17],[-24.41,103.32,0.13],[-24.63,102.54,0.13],[-24.85,101.77,0.12],[-25.1,101.0,0.11],[-25.32,100.22,0.12],[-25.51,99.44,0.18],[-25.69,98.65,0.25],[-25.85,97.87,0.34],[-26.01,97.08,0.43],[-26.16,96.29,0.53],[-26.33,95.51,0.61],[-26.48,94.72,0.68],[-26.64,93.93,0.74],[-26.79,93.13,0.8],[-26.95,92.35,0.87],[-27.15,91.57,0.97],[-27.35,90.79,1.07],[-27.57,90.03,1.19],[-27.82,89.28,1.36],[-28.12,88.55,1.53],[-28.34,87.82,1.8],[-28.31,87.12,2.18],[-28.13,86.47,2.62],[-28.28,85.83,3.07],[-28.75,85.3,3.46],[-29.29,84.82,3.81],[-29.75,84.27,4.18],[-30.19,83.7,4.55]],
    dradial: [[-23.37,109.17,-1.65],[-23.89,108.58,-1.79],[-24.42,108.0,-1.93],[-24.78,107.35,-2.22],[-24.84,106.77,-2.75],[-24.75,106.08,-3.13],[-24.65,105.3,-3.26],[-24.51,104.51,-3.23],[-24.38,103.73,-3.13],[-24.3,102.93,-3.05],[-24.26,102.14,-2.99],[-24.23,101.34,-2.9],[-24.22,100.55,-2.78],[-24.24,99.76,-2.65],[-24.27,98.97,-2.52],[-24.3,98.18,-2.38],[-24.34,97.4,-2.23],[-24.38,96.61,-2.08],[-24.45,95.83,-1.91],[-24.53,95.05,-1.74],[-24.65,94.28,-1.56],[-24.81,93.52,-1.39],[-25.0,92.76,-1.23],[-25.24,92.01,-1.07],[-25.51,91.27,-0.92],[-25.78,90.53,-0.76],[-26.02,89.79,-0.57],[-26.23,89.05,-0.37],[-26.38,88.29,-0.15],[-26.48,87.54,0.1],[-26.54,86.79,0.38],[-26.55,86.04,0.67],[-26.57,85.3,0.96],[-26.6,84.55,1.25]],
    axa: [[-7.96,141.2,-0.31],[-8.52,140.94,-0.41],[-9.05,140.63,-0.5],[-9.58,140.31,-0.55],[-10.1,139.97,-0.54],[-10.62,139.62,-0.53],[-11.13,139.27,-0.56],[-11.63,138.9,-0.6],[-12.09,138.48,-0.68],[-12.49,138.01,-0.78],[-12.84,137.52,-0.92],[-13.16,137.0,-1.04],[-13.48,136.47,-1.13]],
    sca: [[-1.48,141.26,1.62],[-1.79,141.39,1.14],[-2.07,141.52,0.64],[-2.43,141.66,0.2],[-2.92,141.78,-0.09],[-3.47,141.91,-0.21],[-4.04,142.03,-0.18],[-4.62,142.1,-0.08],[-5.2,142.1,-0.04],[-5.78,142.02,-0.07],[-6.35,141.88,-0.11],[-6.9,141.67,-0.16],[-7.43,141.44,-0.23],[-7.96,141.2,-0.31]],
    bra: [[-13.48,136.47,-1.13],[-13.88,135.78,-1.17],[-14.25,135.08,-1.17],[-14.54,134.34,-1.24],[-14.76,133.58,-1.37],[-14.94,132.82,-1.52],[-15.13,132.06,-1.67],[-15.38,131.32,-1.79],[-15.68,130.59,-1.91],[-16.0,129.87,-2.03],[-16.31,129.14,-2.12],[-16.57,128.4,-2.22],[-16.78,127.63,-2.3],[-16.95,126.86,-2.36],[-17.08,126.07,-2.42],[-17.22,125.29,-2.45],[-17.35,124.5,-2.47],[-17.48,123.72,-2.49],[-17.6,122.93,-2.49],[-17.72,122.14,-2.47],[-17.85,121.36,-2.45],[-18.0,120.57,-2.41],[-18.14,119.79,-2.36],[-18.32,119.02,-2.29],[-18.51,118.25,-2.2],[-18.75,117.51,-2.07],[-19.04,116.79,-1.88],[-19.35,116.1,-1.62],[-19.71,115.44,-1.36],[-20.09,114.77,-1.19],[-20.5,114.09,-1.14],[-20.96,113.44,-1.23],[-21.41,112.8,-1.38],[-21.77,112.1,-1.48],[-22.05,111.35,-1.49],[-22.22,110.58,-1.44],[-22.33,109.79,-1.36],[-22.47,109.01,-1.3]],
    symp: [[-1.42,150.27,-0.97],[-1.23,150.38,-0.45],[-1.09,150.31,0.1],[-0.71,150.38,0.46],[-0.64,149.84,0.48],[-0.7,149.26,0.43],[-0.65,148.68,0.4],[-0.63,148.12,0.27],[-0.6,147.55,0.13],[-0.54,146.98,0.03],[-0.56,146.43,-0.06],[-0.58,145.86,-0.17],[-0.53,145.31,-0.35],[-0.5,144.77,-0.58],[-0.53,144.24,-0.81],[-0.74,143.78,-1.12],[-0.96,143.31,-1.38],[-1.06,142.81,-1.68],[-1.13,142.32,-1.98],[-1.3,141.85,-2.18],[-1.34,141.33,-2.46],[-1.34,140.79,-2.69],[-1.33,140.26,-2.94],[-1.31,139.75,-3.23],[-1.31,139.23,-3.5],[-1.34,138.68,-3.7],[-1.37,138.12,-3.87],[-1.35,137.59,-4.11],[-1.37,137.06,-4.37],[-1.47,136.53,-4.57],[-1.53,136.0,-4.84],[-1.52,135.46,-5.07],[-1.58,134.91,-5.27],[-1.62,134.36,-5.48],[-1.66,133.8,-5.64],[-1.67,133.22,-5.74],[-1.72,132.64,-5.84],[-1.75,132.05,-5.93],[-1.73,131.47,-5.95],[-1.65,130.9,-5.9],[-1.71,130.32,-5.9],[-1.75,129.75,-6.02],[-1.71,129.19,-6.15],[-1.79,128.61,-6.05],[-1.82,128.03,-6.07]]
  };
  // ---------- helpers ----------
  function T(kind, opts) { // one clearcoat program for everything (no sheen): cheap shader compiles
    var o = Object.assign({ sheen: 0 }, opts || {});
    if (o.clearcoat === undefined) o.clearcoat = 0.3;
    return Kit.tissue(kind, o);
  }
  function V3(p) { return new THREE.Vector3(p[0], p[1], p[2]); }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function nearest(pts, q) {
    var bi = 0, bd = Infinity;
    pts.forEach(function (p, i) { var d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }
  function curveOf(pts) { return new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal'); }
  // Swept tube along cm points between curve parameters t0..t1, rounded ends.
  function nerve(parent, pts, r, m, t0, t1) {
    t0 = t0 || 0; t1 = t1 === undefined ? 1 : t1;
    var c = curveOf(pts), n = Math.max(8, Math.round(c.getLength() * (t1 - t0) * 2.2));
    var sp = [];
    for (var i = 0; i <= n; i++) sp.push(c.getPointAt(t0 + (t1 - t0) * i / n));
    var cc = new THREE.CatmullRomCurve3(sp, false, 'centripetal');
    var ro = m.depthTest === false ? 20 : 0; // x-ray nerves draw last
    var tb = new THREE.Mesh(new THREE.TubeGeometry(cc, n * 2, r, 10, false), m); tb.renderOrder = ro; parent.add(tb);
    [sp[0], sp[sp.length - 1]].forEach(function (p) {
      var s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m); s.position.copy(p); s.renderOrder = ro; parent.add(s);
    });
    return c;
  }
  function at(pts, t) { var p = curveOf(pts).getPointAt(t); return [p.x, p.y, p.z]; }
  // Keep only the triangles of a baked part on one side of a plane (cm): makes bone fragments.
  function fragment(parent, mesh, part, m, pt, nrm, keepAbove) {
    var me = Kit.meshPart(parent, mesh, part, m);
    var src = me.geometry, pos = src.attributes.position, idx = src.index.array, out = [];
    var n = V3(nrm).normalize(), p0 = V3(pt), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (var i = 0; i < idx.length; i += 3) {
      a.fromBufferAttribute(pos, idx[i]); b.fromBufferAttribute(pos, idx[i + 1]); c.fromBufferAttribute(pos, idx[i + 2]);
      var s = a.add(b).add(c).multiplyScalar(1 / 3).sub(p0).dot(n);
      if ((s > 0) === keepAbove) out.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.array.slice(), 3));
    geo.setIndex(out); geo.computeVertexNormals();
    me.geometry = geo;
    return me;
  }
  // Pivot point of a bone: centroid of its vertices near its proximal (top) end.
  function topEnd(mesh, part, depth) {
    var bb = Kit.meshInfo(mesh).bbox[part], pos = Kit.meshPart(new THREE.Group(), mesh, part, SCRATCH).geometry.attributes.position;
    var s = [0, 0, 0], k = 0;
    for (var i = 0; i < pos.count; i++) {
      if (pos.getY(i) > bb[4] - (depth || 0.35)) { s[0] += pos.getX(i); s[1] += pos.getY(i); s[2] += pos.getZ(i); k++; }
    }
    return [s[0] / k, s[1] / k, s[2] / k];
  }
  // A group that rotates about `pivot` (cm, absolute); add meshes with child().
  function joint(parent, pivot, parentPivot) {
    var j = new THREE.Group();
    var pp = parentPivot || [0, 0, 0];
    j.position.set(pivot[0] - pp[0], pivot[1] - pp[1], pivot[2] - pp[2]);
    j.userData.pivot = pivot; parent.add(j);
    return j;
  }
  function child(j, mesh, part, m) {
    var me = Kit.meshPart(j, mesh, part, m), p = j.userData.pivot;
    me.position.set(-p[0], -p[1], -p[2]); return me;
  }
  // Rotate a joint group about an arbitrary axis (cm direction) by angle (rad), on top of what it has.
  function turn(j, axis, ang) { j.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(V3(axis).normalize(), ang)); }
  // ---------- plexus wiring (cm) ----------
  // Z-Anatomy gives roots, trunks, divisions, the posterior cord and the terminal nerves as curves,
  // but has no lateral or medial cord objects (both anterior-division groups end at a point), starts
  // the axillary nerve at that point and the posterior division of the lower trunk at the lateral
  // cord. Those few links are re-drawn here to textbook topology, short and within the real envelope:
  var LC0 = CL.ad_u[CL.ad_u.length - 1];           // anterior divisions of upper + middle trunks meet
  var MC0 = CL.ad_l[CL.ad_l.length - 1];           // anterior division of lower trunk
  var PC0 = CL.pc[0], PCE = CL.pc[CL.pc.length - 1];
  var LCE = [-13.9, 137.75, -0.95];                // end of the lateral cord, lateral to the axillary artery
  var UK = nearest(CL.uln, [-12.6, 137.3, -0.7]);   // the medial cord is the first stretch of Z-Anatomy's ulnar curve
  var MCE = CL.uln[UK];
  var MK = nearest(CL.med, [-16.4, 134.1, -0.8]);   // median nerve formed in front of the artery
  var M = CL.med[MK];
  var AK = nearest(CL.ax, [-13.7, 136.8, -2.1]);
  var MCN_K = 0;
  // Exploded view: the real plexus is a tight cable (all three trunks end within 3 mm of each other in
  // Z-Anatomy), so trunks and cords are spread apart in the coronal plane, perpendicular to the plexus
  // course, the way a dissector retracts them. Offsets are zero at the intervertebral foramina and fade
  // out along the terminal nerves, so roots and branches stay where Z-Anatomy puts them.
  var NUP = [-0.67, 0.74, 0];                       // superolateral, perpendicular to the plexus course
  function lev(k, z) { return [NUP[0] * k, NUP[1] * k, z || 0]; }
  function arcs(pts) {
    var s = [0];
    for (var i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    return s;
  }
  function sstep(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  // o0 -> o1 along the whole curve, or (fade > 0) o0 -> 0 over the first `fade` cm.
  function explode(pts, o0, o1, fade) {
    var s = arcs(pts), L = s[s.length - 1] || 1;
    return pts.map(function (p, i) {
      var w = fade ? sstep(s[i] / fade) : sstep(s[i] / L), a = fade ? [0, 0, 0] : o1;
      return [p[0] + o0[0] + (a[0] - o0[0]) * w, p[1] + o0[1] + (a[1] - o0[1]) * w, p[2] + o0[2] + (a[2] - o0[2]) * w];
    });
  }
  var O = { root: lev(0), utS: lev(0.6), mtS: lev(0), ltS: lev(-0.6), utE: lev(2.0), mtE: lev(0), ltE: lev(-2.0),
    lc: lev(1.4), pc: lev(0, -0.2), mc: lev(-1.4), med: lev(0) };
  // Z-Anatomy runs the long thoracic nerve in front of the trunks and the axillary artery; it belongs
  // behind them (it descends behind the plexus to the serratus anterior), so it is pushed back there.
  function behind(pts) {
    return pts.map(function (p) { var w = sstep((148.5 - p[1]) / 4) * sstep((p[1] - 126) / 6); return [p[0], p[1], p[2] - 3.4 * w]; });
  }
  var W = {
    C5: explode(CL.C5, O.root, O.utS), C6: explode(CL.C6, O.root, O.utS), C7: explode(CL.C7, O.root, O.mtS),
    C8: explode(CL.C8, O.root, O.ltS), T1: explode(CL.T1, O.root, O.ltS),
    ut: explode(CL.ut, O.utS, O.utE), mt: explode(CL.mt, O.mtS, O.mtE), lt: explode(CL.lt, O.ltS, O.ltE),
    ad_u: explode(CL.ad_u, O.utE, O.lc), ad_m: explode(CL.ad_m, O.mtE, O.lc), ad_l: explode(CL.ad_l, O.ltE, O.mc),
    pd_u: explode(CL.pd_u, O.utE, O.pc), pd_m: explode(CL.pd_m, O.mtE, O.pc),
    pd_l: explode([CL.lt[CL.lt.length - 1], [-9.0, 141.0, -2.45], [-9.6, 140.4, -2.75], PC0], O.ltE, O.pc),
    lc: explode([LC0, [-12.0, 139.15, -1.3], [-13.0, 138.45, -1.1], LCE], O.lc, O.lc),
    pc: explode(CL.pc, O.pc, O.pc),
    mc: explode(CL.uln.slice(0, UK + 1), O.mc, O.mc),
    mcn: explode([LCE, [-15.2, 136.2, -0.75], [-16.6, 133.5, -0.8]].concat(CL.mcn.slice(MCN_K)), O.lc, null, 7),
    lroot: explode([LCE, [-14.9, 136.4, -0.55], [-15.8, 135.1, -0.6], M], O.lc, O.med),
    mroot: explode([MCE, [-13.6, 136.0, -0.2], [-14.9, 134.7, -0.35], M], O.mc, O.med),
    med: CL.med.slice(MK),
    uln: explode(CL.uln.slice(UK), O.mc, null, 6),
    ax: explode([PCE, [-12.9, 137.3, -2.35]].concat(CL.ax.slice(AK)), O.pc, null, 4),
    rad: explode(CL.rad, O.pc, null, 5),
    ss: explode(CL.ss, O.utS, null, 4), ltn: behind(CL.ltn), ltn2: CL.ltn2,
  };
  var RAD = { C5: .24, C6: .24, C7: .24, C8: .24, T1: .22, ut: .3, mt: .27, lt: .29, ad_u: .2, ad_m: .19, ad_l: .21,
    pd_u: .19, pd_m: .18, pd_l: .16, lc: .27, pc: .28, mc: .25, mcn: .17, lroot: .19, mroot: .19, med: .22, uln: .2,
    ax: .19, rad: .24, ss: .14, ltn: .12, ltn2: .1 };
  var POSTERIOR = { pd_u: 1, pd_m: 1, pd_l: 1, pc: 1, ax: 1, rad: 1 };

  // variant: lesion = [segment, t], dead = segments (or [segment, t0]) that lose function distal to it
  var LESION = {
    erb: { at: ['ut', 0.22], dead: [['ut', 0.22], 'ad_u', 'pd_u', 'ss', 'mcn', 'ax'] },
    klumpke: { at: ['lt', 0.3], dead: [['lt', 0.3], 'ad_l', 'pd_l', 'mc', 'mroot', 'uln'] },
    lt: { at: ['ltn', 0.5], dead: [['ltn', 0.5]] },
    rad: { at: ['rad', 0.5], dead: [['rad', 0.5]] },
  };
  var SCRATCH = null;
  var C_NERVE = 0xffd94a, C_POST = 0xf0a040, C_DEAD = 0x6c6a62, C_LESION = 0xff3b2f;

  // ---------- the posed limb inset (cm, then placed with its own scale and view) ----------
  // Bones from meshes/hand.js (+ humerus, scapula, clavicle, ribs, spine from upper-limb.js), each in a
  // joint group so a variant can show the deformity that the lesion produces.
  function limb(parent, opts) {
    var bone = T('bone'), dim = T('bone', { opacity: 0.35, depthWrite: false });
    var root = new THREE.Group(); parent.add(root);
    var sh = [-16.2, 137.6, -2.8];             // glenohumeral centre (humeral head)
    var el = [-22.3, 109.6, -2.2];             // elbow (trochlea/capitulum)
    var wr = topEnd('hand', 'carpals', 0.6);   // radiocarpal joint
    if (opts.trunk) {
      Kit.meshPart(root, 'upper-limb', 'ribs', opts.trunkMat || bone);
      Kit.meshPart(root, 'upper-limb', 'rib1', opts.trunkMat || bone);
      Kit.meshPart(root, 'upper-limb', 'spine', opts.trunkMat || bone);
    }
    if (opts.scapula) {
      var sc = joint(root, opts.wingAxis || sh);
      child(sc, 'upper-limb', 'scapula', bone);
      if (opts.wing) turn(sc, [0, 1, 0.15], opts.wing);
      if (opts.clavicle) Kit.meshPart(root, 'upper-limb', 'clavicle', bone);
    }
    var out = { root: root, wr: wr, sh: sh, el: el };
    if (opts.arm) {
      var arm = joint(root, sh);
      child(arm, 'upper-limb', 'humerus', bone);
      out.arm = arm;
    }
    if (opts.noForearm) return out;
    var fa = joint(out.arm || root, el, out.arm ? sh : null);
    if (opts.forearmCut) { // distal forearm only
      ['radius', 'ulna'].forEach(function (b) { fragment(fa, 'hand', b, bone, [0, opts.forearmCut, 0], [0, 1, 0], false).position.set(-el[0], -el[1], -el[2]); });
    } else if (!opts.handOnly) {
      child(fa, 'hand', 'radius', bone);
      child(fa, 'hand', 'ulna', bone);
    }
    var hd = joint(fa, wr, el);
    child(hd, 'hand', 'carpals', bone);
    out.fa = fa; out.hand = hd; out.fingers = [];
    for (var f = 1; f <= 5; f++) {
      var mcp = topEnd('hand', 'pp' + f), ch = [];
      child(hd, 'hand', 'mc' + f, bone);
      var j1 = joint(hd, mcp, wr); child(j1, 'hand', 'pp' + f, bone); ch.push(j1);
      var prev = mcp, jp = j1;
      (f === 1 ? ['dp1'] : ['mp' + f, 'dp' + f]).forEach(function (pt) {
        var pv = topEnd('hand', pt), j = joint(jp, pv, prev); child(j, 'hand', pt, bone); ch.push(j); prev = pv; jp = j;
      });
      out.fingers.push(ch);
    }
    return out;
  }
  // Flex (+) or extend (-) a finger joint about the transverse (x) axis.
  function flex(j, deg) { turn(j, [1, 0, 0], -deg * Math.PI / 180); }

  Kit.register({
    id: 'plexus',
    meshes: ['upper-limb', 'hand'],
    center: [0, 0, 0],
    zoom: 9,
    rot: [0.06, 0.1],
    controls: [{ k: 'v', label: 'Condition', def: 'norm', opts: [
      ['norm', 'Normal plexus'],
      ['erb', 'Erb palsy (upper trunk, C5-C6)'],
      ['klumpke', 'Klumpke palsy (lower trunk, C8-T1)'],
      ['lt', 'Long thoracic nerve injury'],
      ['rad', 'Radial nerve: midshaft humerus fracture'],
    ] }],
    build: function (g, st) {
      var v = st.v, les = LESION[v] || null;
      SCRATCH = T('bone');
      // main view: whole frame for the normal plexus, left 2/3 when a posed-limb inset is shown
      var SM = v === 'norm' ? 0.3 : v === 'rad' ? 0.19 : 0.21;
      var MCEN = v === 'norm' ? [-9.6, 140.2, -1.5] : v === 'rad' ? [-17.0, 129.0, -1.5] : [-11.5, 137.5, -1.5];
      var MPOS = v === 'norm' ? [0, 0, 0] : [-2.3, -0.1, 0];
      // the arm is turned toward the viewer for the radial nerve, whose spiral groove is posterolateral
      var bodyR = new THREE.Group(); bodyR.position.set(MPOS[0], MPOS[1], MPOS[2]); bodyR.rotation.y = v === 'rad' ? 2.55 : 0; g.add(bodyR);
      function P(x, y, z) {
        var q = new THREE.Vector3(x, y, z); body.updateMatrix(); bodyR.updateMatrix();
        q.applyMatrix4(body.matrix).applyMatrix4(bodyR.matrix); return [q.x, q.y, q.z];
      }
      function Pa(a) { return P(a[0], a[1], a[2]); }
      var body = new THREE.Group(); body.scale.setScalar(SM);
      body.position.set(-MCEN[0] * SM, -MCEN[1] * SM, -MCEN[2] * SM);
      bodyR.add(body);
      if (v === 'rad') { var hm = P(-20, 126, -2.6); bodyR.position.x += -1.9 - hm[0]; bodyR.position.y += -0.3 - hm[1]; }

      // ---- skeleton and muscles ----
      var bone = T('bone', { color: 0xa99a7e });
      Kit.meshPart(body, 'upper-limb', 'spine', bone);
      Kit.meshPart(body, 'upper-limb', 'rib1', T('bone', { color: 0xd8c39a }));
      Kit.meshPart(body, 'upper-limb', 'ribs', T('bone', { color: 0xa99a7e, opacity: v === 'rad' ? 0.18 : 0.45, depthWrite: false }));
      Kit.meshPart(body, 'upper-limb', 'clavicle', T('bone', { opacity: 0.3, depthWrite: false }));
      var scap = joint(body, [-16.5, 133.0, -5.5]);
      child(scap, 'upper-limb', 'scapula', T('bone', { opacity: v === 'lt' ? 0.9 : v === 'norm' ? 0.75 : 0.45, depthWrite: v === 'lt' }));
      if (v === 'lt') turn(scap, [0, 1, 0.15], 0.42); // winging: medial border lifts off the chest wall
      if (v === 'rad') {
        var cut = [-19.8, 124.0, -2.6], cn = [0.35, 1, 0.25];
        fragment(body, 'upper-limb', 'humerus', T('bone', { opacity: 0.8, depthWrite: false }), cut, cn, true);
        var lo = new THREE.Group(); body.add(lo);
        fragment(lo, 'upper-limb', 'humerus', T('bone', { opacity: 0.8, depthWrite: false }), cut, cn, false);
        lo.position.set(1.3, -0.9, 0.5); // displaced distal fragment
        var fr = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.13, 8, 40), T('highlight', { color: C_LESION, emissive: C_LESION, emissiveIntensity: 0.6, opacity: 0.7, depthWrite: false }));
        fr.position.set(cut[0], cut[1], cut[2]); fr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V3(cn).normalize()); body.add(fr);
      } else {
        Kit.meshPart(body, 'upper-limb', 'humerus', T('bone'));
      }
      Kit.meshPart(body, 'upper-limb', 'scalenus_anterior', T('muscle', { opacity: 0.16, depthWrite: false }));
      if (v === 'lt') Kit.meshPart(body, 'upper-limb', 'serratus_anterior', T('muscle', { color: 0x8a7470, opacity: 0.4, depthWrite: false }));

      // ---- vessels ----
      var art = T('vessel-artery');
      nerve(body, CL.sca, 0.42, art); nerve(body, CL.axa, 0.4, art); nerve(body, CL.bra, 0.33, art);

      // ---- nerves ----
      var mats = {};
      function mat(c) { return mats[c] || (mats[c] = T('nerve', { color: c })); }
      var deadMap = {};
      if (les) les.dead.forEach(function (d) { if (typeof d === 'string') deadMap[d] = 0; else deadMap[d[0]] = d[1]; });
      Object.keys(W).forEach(function (k) {
        var live = mat(POSTERIOR[k] && v === 'norm' ? C_POST : C_NERVE), dead = mat(C_DEAD);
        var rk = RAD[k];
        if (v === 'lt' && (k === 'ltn' || k === 'ltn2')) { // shown through the chest wall (x-ray style) so its whole course reads
          rk *= 1.6; live = T('nerve', { color: C_NERVE, depthTest: false, transparent: true, opacity: 0.95 }); dead = T('nerve', { color: 0x8a8880, depthTest: false, transparent: true, opacity: 0.95 });
        }
        if (deadMap[k] === undefined) nerve(body, W[k], rk, live);
        else if (deadMap[k] === 0) nerve(body, W[k], rk, dead);
        else { nerve(body, W[k], rk, live, 0, deadMap[k]); nerve(body, W[k], rk, dead, deadMap[k], 1); }
      });
      if (les) {
        var lp = at(W[les.at[0]], les.at[1]);
        var hl = T('highlight', { color: C_LESION, emissive: C_LESION, emissiveIntensity: 0.8 });
        var ball = new THREE.Mesh(new THREE.SphereGeometry(RAD[les.at[0]] * 2.1 + 0.25, 20, 14), T('highlight', { color: C_LESION, emissive: C_LESION, emissiveIntensity: 0.6, opacity: 0.45, depthWrite: false }));
        ball.position.set(lp[0], lp[1], lp[2]); body.add(ball);
        var core = new THREE.Mesh(new THREE.SphereGeometry(RAD[les.at[0]] * 1.25, 16, 12), hl);
        core.position.copy(ball.position); body.add(core);
      }
      if (v === 'klumpke') { // Horner: T1 preganglionic sympathetic fibres reach the stellate (cervicothoracic) ganglion
        nerve(body, CL.symp.map(function (p) { return [p[0] - 1.0, p[1], p[2]]; }), 0.12, T('nerve', { color: 0xc9b8e8 }));
        var stl = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12), T('nerve', { color: 0xb59be0, emissive: 0x5a3a90, emissiveIntensity: 0.4 }));
        stl.scale.set(0.8, 1.5, 0.8); stl.position.set(-2.05, 143.4, -1.4); body.add(stl);
        var t1p = at(CL.T1, 0.12);
        var amb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), T('highlight', { color: 0xffa020, emissive: 0xffa020, emissiveIntensity: 0.6, opacity: 0.5, depthWrite: false }));
        amb.position.set(t1p[0], t1p[1], t1p[2]); body.add(amb);
      }

      // ---- labels ----
      var L = [];
      function lab(t, p) { L.push({ t: t, p: Pa(p) }); }
      if (v === 'norm') {
        lab('C5', at(CL.C5, 0.15)); lab('C6', at(CL.C6, 0.12)); lab('C7', at(CL.C7, 0.1)); lab('C8', at(CL.C8, 0.1)); lab('T1', at(CL.T1, 0.12));
        lab('Upper trunk', at(W.ut, 0.45)); lab('Middle trunk', at(W.mt, 0.5)); lab('Lower trunk', at(W.lt, 0.5));
        lab('Divisions (behind clavicle)', at(W.ad_m, 0.4));
        lab('Lateral cord', at(W.lc, 0.6)); lab('Posterior cord', at(W.pc, 0.6)); lab('Medial cord', at(W.mc, 0.6));
        lab('Musculocutaneous n.', at(W.mcn, 0.35)); lab('Axillary n.', at(W.ax, 0.8)); lab('Radial n.', at(W.rad, 0.32));
        lab('Median n.', at(W.med, 0.07)); lab('Ulnar n.', at(W.uln, 0.12));
        lab('Long thoracic n.', at(W.ltn, 0.55)); lab('Suprascapular n.', at(W.ss, 0.5));
        lab('Axillary artery', at(CL.axa, 0.5)); lab('First rib', [-4.0, 140.2, 2.0]); lab('Clavicle', [-13.5, 141.6, 2.5]);
      }

      // ---- posed-limb inset: the deformity the lesion produces ----
      var IL = [];
      if (v !== 'norm') {
        var IG = new THREE.Group(); IG.position.set(2.65, 0, 0); g.add(IG);
        var panel = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.2), new THREE.MeshBasicMaterial({ color: 0x18202c }));
        panel.position.set(2.65, -0.05, -1.6); g.add(panel);
        var IR = new THREE.Group(); IG.add(IR);
        var IS = new THREE.Group(); IR.add(IS);
        var ic, lb, sI;
        if (v === 'erb') {
          lb = limb(IS, { arm: true, scapula: true, clavicle: true });
          turn(lb.arm, [6.1, 28, -0.6], 1.15);            // internal rotation (teres minor/infraspinatus lost)
          turn(lb.fa, [3, 24, -2], 1.4);                   // pronation (biceps/supinator lost)
          flex(lb.hand, 45);                               // wrist flexed (C6 extensor weakness)
          lb.fingers.forEach(function (f, i) { if (i) { flex(f[0], 20); flex(f[1], 25); } });
          IR.rotation.y = Math.PI - 0.35; sI = 0.072; ic = [-21, 106, -3];
        } else if (v === 'klumpke') {
          lb = limb(IS, { forearmCut: 92 });
          lb.fingers.forEach(function (f, i) { if (i) { flex(f[0], -28); flex(f[1], 78); flex(f[2], 50); } });
          IR.rotation.y = -Math.PI / 2 + 0.35; sI = 0.17; ic = [-26, 80, 3];
        } else if (v === 'lt') {
          lb = limb(IS, { trunk: true, scapula: true, noForearm: true, wing: 0.42, wingAxis: [-16.5, 133.0, -5.5] });
          Kit.meshPart(IS, 'upper-limb', 'scapula', T('bone', { color: 0x7fb0d0, opacity: 0.28, depthWrite: false })); // normal position
          IR.rotation.y = Math.PI - 0.75; sI = 0.105; ic = [-9, 133, -5];
        } else {
          lb = limb(IS, { forearmCut: 100 });
          turn(lb.fa, [3, 24, -2], 2.7);                   // pronated forearm (palm down)
          flex(lb.hand, 62);                               // wrist drop
          lb.fingers.forEach(function (f, i) { if (i) { flex(f[0], 38); flex(f[1], 12); } });
          IR.rotation.y = Math.PI / 2; IG.rotation.z = Math.PI / 2; sI = 0.125; ic = [-26.5, 87, 0];
        }
        IS.scale.setScalar(sI); IS.position.set(-ic[0] * sI, -ic[1] * sI, -ic[2] * sI);
        IG.updateMatrixWorld(true);
        var iP = function (grp, p) { var pv = grp.userData.pivot || [0, 0, 0]; var q = new THREE.Vector3(p[0] - pv[0], p[1] - pv[1], p[2] - pv[2]); grp.localToWorld(q); g.worldToLocal(q); return [q.x, q.y, q.z]; };
        if (v === 'erb') {
          IL.push({ t: "Waiter's tip", p: iP(lb.hand, [-27, 72, 4]) });
          IL.push({ t: 'Adducted, internally rotated', p: iP(lb.arm, [-19, 124, -3]) });
          IL.push({ t: 'Elbow extended, pronated', p: iP(lb.fa, [-24, 98, -1]) });
        } else if (v === 'klumpke') {
          IL.push({ t: 'Claw hand', p: iP(lb.hand, [-25.5, 81, 3]) });
          IL.push({ t: 'MCP extended, IP flexed', p: iP(lb.fingers[2][1], [-28, 74, 6]) });
        } else if (v === 'lt') {
          IL.push({ t: 'Winged scapula (from behind)', p: iP(IS, [-7.5, 128, -10]) });
        } else {
          IL.push({ t: 'Wrist drop', p: iP(lb.hand, [-27, 72, 4]) });
          IL.push({ t: 'Pronated forearm', p: iP(lb.fa, [-24, 96, 0]) });
        }
      }
      if (v === 'erb') {
        lab('Erb point: upper trunk (C5-C6)', at(W.ut, 0.22)); lab('C5', at(CL.C5, 0.15)); lab('C6', at(CL.C6, 0.12));
        lab('Suprascapular n. (supra/infraspinatus)', at(W.ss, 0.2)); lab('Musculocutaneous n. (biceps)', at(W.mcn, 0.3));
        lab('Axillary n. (deltoid, teres minor)', at(W.ax, 0.85)); lab('Middle / lower trunks intact', at(W.lt, 0.6));
      } else if (v === 'klumpke') {
        lab('Lower trunk (C8-T1)', at(W.lt, 0.3)); lab('C8', at(CL.C8, 0.1)); lab('T1', at(CL.T1, 0.12));
        lab('Medial cord', at(W.mc, 0.6)); lab('Ulnar n. (intrinsics)', at(W.uln, 0.1)); lab('Median n. (medial root)', at(W.mroot, 0.5));
        lab('Stellate ganglion: Horner', [-2.05, 142.6, -1.0]); lab('Upper trunk intact', at(W.ut, 0.45));
      } else if (v === 'lt') {
        lab('Long thoracic n. (C5-C7)', at(W.ltn, 0.3)); lab('Injury on chest wall', at(W.ltn, 0.5));
        lab('Serratus anterior (paralysed)', [-11.5, 124, 1.5]); lab('Scapula', [-15, 129, -7]); lab('Plexus intact', at(W.mt, 0.5));
      } else if (v === 'rad') {
        lab('Midshaft humerus fracture', [-19.6, 123.6, 0]); lab('Radial n. in spiral groove', at(W.rad, 0.5));
        lab('Radial n. (posterior cord)', at(W.rad, 0.2)); lab('Humerus (posterior view)', [-19, 132, -5]);
        lab('Wrist and finger extensors lost', at(W.rad, 0.85));
      }
      L = L.concat(IL);
      return { labels: L, info: '' };
    },
  });
})();
