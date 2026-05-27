export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 方案路由：如果是获取数据的请求，后端安全调用 GraphQL
    if (url.pathname === "/api/usage") {
      return await handleDataFetch(env);
    }

    // 默认路由：直接返回高级赛博风的前端 HTML 界面
    return new Response(htmlContent, {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

// 安全后端：负责向 Cloudflare 总部查询数据
async function handleDataFetch(env) {
  const ACCOUNT_ID = env.ACCOUNT_ID;
  const API_TOKEN = env.API_TOKEN;
  
  if (!ACCOUNT_ID || !API_TOKEN) {
    return new Response(JSON.stringify({ error: "未配置环境变量" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }

  // 严格死守官方 100k 免费额度重置的标准 UTC 时间轴
  const today = new Date().toISOString().split('T')[0];
  const query = `
  query {
    viewer {
      accounts(filter: {accountTag: "${ACCOUNT_ID}"}) {
        workersInvocationsAdaptive(limit: 1, filter: {datetime_geq: "${today}T00:00:00Z", datetime_leq: "${today}T23:59:59Z"}) {
          sum { requests }
        }
      }
    }
  }`;

  try {
    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });
    const resData = await response.json();
    
    if (resData.errors && resData.errors.length > 0) {
      return new Response(JSON.stringify({ requests: -1, error: resData.errors[0].message }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    if (!resData.data?.viewer?.accounts || resData.data.viewer.accounts.length === 0) {
      return new Response(JSON.stringify({ requests: -1, error: "ACCOUNT_ID 错误，未匹配到任何账户" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const requests = resData.data.viewer.accounts[0].workersInvocationsAdaptive[0]?.sum?.requests || 0;
    return new Response(JSON.stringify({ requests }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ requests: -1, error: err.message }), { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

// 前端界面：错落有致物理数字雨 + 精准域遮罩仪表盘
const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CF 终端控制台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: #050508;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: "Courier New", Courier, monospace, -apple-system;
            overflow: hidden;
            position: relative;
        }
        
        #matrix-canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            opacity: 0.55; 
        }

        /* 核心容器 */
        .container { 
            position: relative; 
            z-index: 10; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
        }

        /* 精准缩小中央阅读遮罩层，完美贴合圆环本身大小 */
        .readability-mask {
            position: absolute;
            z-index: 5; 
            width: 38vmin; 
            height: 38vmin;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(5,5,8,1) 50%, rgba(5,5,8,0.8) 75%, rgba(5,5,8,0) 100%);
            filter: blur(12px); 
            pointer-events: none; 
        }

        /* 纯净主环响应式容器 */
        .hud-box { 
            position: relative; 
            width: 65vmin; 
            height: 65vmin; 
            max-width: 680px; 
            min-width: 320px;
            display: flex; 
            justify-content: center; 
            align-items: center; 
        }

        svg { position: absolute; width: 100%; height: 100%; }
        
        circle.track { fill: none; stroke: rgba(255, 255, 255, 0.04); stroke-width: 10px; }
        circle.progress {
            fill: none;
            stroke: var(--theme-color, #ffffff);
            stroke-width: 10px;
            stroke-linecap: round;
            stroke-dasharray: 628;
            stroke-dashoffset: 628;
            transition: stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 1s ease;
            filter: drop-shadow(0 0 16px var(--theme-color, #ffffff));
        }

        .center-text { text-align: center; position: absolute; z-index: 12; }
        .usage-value { font-size: 2.5vmin; color: rgba(255, 255, 255, 0.6); font-weight: 400; letter-spacing: 1px; margin-bottom: 8px; }
        .percentage { font-size: 7.5vmin; font-weight: 300; color: #ffffff; letter-spacing: -0.5px; animation: breathe 4s infinite ease-in-out; }
        
        @keyframes breathe {
            0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 2px rgba(255,255,255,0.1)); }
            50% { opacity: 1; filter: drop-shadow(0 0 16px var(--theme-color, rgba(255,255,255,0.4))); }
        }
    </style>
</head>
<body>

    <canvas id="matrix-canvas"></canvas>
    
    <div class="readability-mask"></div>

    <div class="container">
        <div class="hud-box">
            <svg viewBox="0 0 400 400">
                <circle class="track" cx="200" cy="200" r="100"></circle>
                <circle class="progress" id="progress-bar" cx="200" cy="200" r="100" transform="rotate(-90 200 200)"></circle>
            </svg>
            
            <div class="center-text">
                <div class="usage-value" id="usage-txt">INIT...</div>
                <div class="percentage" id="percent-txt">0%</div>
            </div>
        </div>
    </div>

    <script>
        // ==================== 1. 错落有致：真·独立速度数字雨 ====================
        const canvas = document.getElementById('matrix-canvas');
        const ctx = canvas.getContext('2d');

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const chars = "01010101ABCDEFGHIJKLMNOPQRSTUVWXYZ_#[@]$%";
        const charArr = chars.split("");
        
        const fontSize = 17; 
        const trailLength = 12; 
        
        let columns = Math.floor(canvas.width / fontSize);
        let drops = [];
        let speeds = []; 
        let columnStrings = []; // 用于存放每一列当前下落的固定字符数组

        // 生成固定字符长度序列的方法
        function generateFixedTrail(length) {
            let arr = [];
            for (let i = 0; i < length; i++) {
                arr.push(charArr[Math.floor(Math.random() * charArr.length)]);
            }
            return arr;
        }

        for (let i = 0; i < columns; i++) {
            drops[i] = Math.random() * (canvas.height / fontSize + trailLength) - trailLength;
            speeds[i] = Math.random() * 0.5 + 0.35; 
            columnStrings[i] = generateFixedTrail(trailLength); // 初始化时锁死字符
        }

        function drawMatrix() {
            ctx.fillStyle = "rgba(5, 5, 8, 1)"; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.font = fontSize + "px 'Courier New'";

            for (let i = 0; i < drops.length; i++) {
                const headY = drops[i] * fontSize;

                for (let j = 0; j < trailLength; j++) {
                    const charY = headY - (j * fontSize);
                    
                    let baseAlpha = 0.85 * (1 - j / trailLength); 
                    if (baseAlpha < 0.05) continue; 

                    ctx.fillStyle = "rgba(0, 242, 254, " + baseAlpha + ")";
                    
                    // 从当前列锁死的字符串中直接读取对应的字符，不再通过 Math.random 乱跳
                    const text = columnStrings[i][j];
                    ctx.fillText(text, i * fontSize, charY);
                }

                if (headY - (trailLength * fontSize) > canvas.height && Math.random() > 0.98) {
                    drops[i] = -Math.random() * 15; 
                    speeds[i] = Math.random() * 0.5 + 0.35; 
                    columnStrings[i] = generateFixedTrail(trailLength); // 只有触底刷新时才重新抽签分配新字符
                }
                
                drops[i] += speeds[i]; 
            }
        }
        
        setInterval(drawMatrix, 30);

        // ==================== 2. 额度数据交互 ====================
        const LIMIT = 100000; 
        
        function getColorByPercent(p) {
            if (p === 0) return '#ffffff';
            if (p >= 100) return '#ff1744';
            if (p > 90) return '#ff1744';
            if (p > 65) return '#ff5722';
            if (p > 35) return '#ffd600';
            return '#00e676';
        }

        async function updateUI() {
            try {
                const response = await fetch('/api/usage');
                const data = await response.json();
                
                if (data.error || data.requests < 0) {
                    document.getElementById('percent-txt').innerText = "ERR";
                    document.getElementById('usage-txt').innerText = "ERROR LOG";
                    document.documentElement.style.setProperty('--theme-color', '#ff1744');
                    return;
                }
                
                const requests = data.requests;
                let percent = Math.min(Math.round((requests / LIMIT) * 100), 100);
                
                document.getElementById('usage-txt').innerText = requests.toLocaleString() + " / 100,000";
                document.getElementById('percent-txt').innerText = percent + "%";
                
                const circle = document.getElementById('progress-bar');
                const offset = 628 - (628 * percent) / 100;
                circle.style.strokeDashoffset = offset;
                
                const themeColor = getColorByPercent(percent);
                document.documentElement.style.setProperty('--theme-color', themeColor);
                
                if(percent >= 100) {
                    document.getElementById('percent-txt').innerText = "OVER";
                }
            } catch (err) {
                document.getElementById('percent-txt').innerText = "ERR";
            }
        }

        updateUI();
        setInterval(updateUI, 300000);
    </script>
</body>
</html>
`;
