import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

// 強制使用 Edge Runtime 以支援 Cloudflare Pages
export const runtime = 'edge';

// TVBox源格式介面
interface TVBoxSource {
  key: string;
  name: string;
  type: number; // 0=影視源, 1=直播源, 3=解析源
  api: string;
  searchable?: number; // 0=不可搜索, 1=可搜索
  quickSearch?: number; // 0=不支援快速搜索, 1=支援快速搜索
  filterable?: number; // 0=不支援分類篩選, 1=支援分類篩選
  ext?: string; // 擴充套件參數
  jar?: string; // jar包地址
  playUrl?: string; // 播放解析地址
  categories?: string[]; // 分類
  timeout?: number; // 超時時間(秒)
}

interface TVBoxConfig {
  spider?: string; // 爬蟲jar包地址
  wallpaper?: string; // 壁紙地址
  lives?: Array<{
    name: string;
    type: number;
    url: string;
    epg?: string;
    logo?: string;
  }>; // 直播源
  sites: TVBoxSource[]; // 影視源
  parses?: Array<{
    name: string;
    type: number;
    url: string;
    ext?: Record<string, unknown>;
    header?: Record<string, string>;
  }>; // 解析源
  flags?: string[]; // 播放標識
  ijk?: Record<string, unknown>; // IJK播放器配置
  ads?: string[]; // 廣告過濾規則
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // 支援json和base64格式
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    // 讀取目前配置
    const config = await getConfig();
    
    // 從配置中獲取源站列表
    const sourceConfigs = config.SourceConfig || [];
    
    if (sourceConfigs.length === 0) {
      return NextResponse.json({ error: '沒有配置任何視訊源' }, { status: 500 });
    }

    // 轉換為TVBox格式
    const tvboxConfig: TVBoxConfig = {
      // 基礎配置
      spider: '', // 可以根據需要新增爬蟲jar包
      wallpaper: `${baseUrl}/screenshot1.png`, // 使用專案截圖作為壁紙
      
      // 影視源配置
      sites: sourceConfigs.map((source) => {
        // 更智慧的type判斷邏輯：
        // 1. 如果api地址包含 "/provide/vod" 且不包含 "at/xml"，則認為是JSON型別 (type=1)
        // 2. 如果api地址包含 "at/xml"，則認為是XML型別 (type=0)
        // 3. 如果api地址以 ".json" 結尾，則認為是JSON型別 (type=1)
        // 4. 其他情況預設為JSON型別 (type=1)，因為現在大部分都是JSON
        let type = 1; // 預設為JSON型別
        
        const apiLower = source.api.toLowerCase();
        if (apiLower.includes('at/xml') || apiLower.endsWith('.xml')) {
          type = 0; // XML型別
        }
        
        return {
          key: source.key || source.name,
          name: source.name,
          type: type, // 使用智慧判斷的type
          api: source.api,
          searchable: 1, // 可搜索
          quickSearch: 1, // 支援快速搜索
          filterable: 1, // 支援分類篩選
          ext: source.detail || '', // 詳情頁地址作為擴充套件參數
          timeout: 30, // 30秒超時
          categories: [
            "電影", "電視劇", "綜藝", "動漫", "紀錄片", "短劇"
          ]
        };
      }),

      // 解析源配置（新增一些常用的解析源）
      parses: [
        {
          name: "Json併發",
          type: 2,
          url: "Parallel"
        },
        {
          name: "Json輪詢",
          type: 2, 
          url: "Sequence"
        },
        {
          name: "KatelyaTV內建解析",
          type: 1,
          url: `${baseUrl}/api/parse?url=`,
          ext: {
            flag: ["qiyi", "qq", "letv", "sohu", "youku", "mgtv", "bilibili", "wasu", "xigua", "1905"]
          }
        }
      ],

      // 播放標識
      flags: [
        "youku", "qq", "iqiyi", "qiyi", "letv", "sohu", "tudou", "pptv", 
        "mgtv", "wasu", "bilibili", "le", "duoduozy", "renrenmi", "xigua",
        "優酷", "騰訊", "愛奇藝", "奇藝", "樂視", "搜狐", "土豆", "PPTV",
        "芒果", "華數", "嗶哩", "1905"
      ],

      // 直播源（可選）
      lives: [
        {
          name: "KatelyaTV直播",
          type: 0,
          url: `${baseUrl}/api/live/channels`,
          epg: "",
          logo: ""
        }
      ],

      // 廣告過濾規則
      ads: [
        "mimg.0c1q0l.cn",
        "www.googletagmanager.com", 
        "www.google-analytics.com",
        "mc.usihnbcq.cn",
        "mg.g1mm3d.cn",
        "mscs.svaeuzh.cn",
        "cnzz.hhurm.com",
        "tp.vinuxhome.com",
        "cnzz.mmstat.com",
        "www.baihuillq.com",
        "s23.cnzz.com",
        "z3.cnzz.com",
        "c.cnzz.com",
        "stj.v1vo.top",
        "z12.cnzz.com",
        "img.mosflower.cn",
        "tips.gamevvip.com",
        "ehwe.yhdtns.com",
        "xdn.cqqc3.com",
        "www.jixunkyy.cn",
        "sp.chemacid.cn",
        "hm.baidu.com",
        "s9.cnzz.com",
        "z6.cnzz.com",
        "um.cavuc.com",
        "mav.mavuz.com",
        "wofwk.aoidf3.com",
        "z5.cnzz.com",
        "xc.hubeijieshikj.cn",
        "tj.tianwenhu.com",
        "xg.gars57.cn",
        "k.jinxiuzhilv.com",
        "cdn.bootcss.com",
        "ppl.xunzhuo123.com",
        "xomk.jiangjunmh.top",
        "img.xunzhuo123.com",
        "z1.cnzz.com",
        "s13.cnzz.com",
        "xg.huataisangao.cn",
        "z7.cnzz.com",
        "xg.huataisangao.cn",
        "z2.cnzz.com",
        "s96.cnzz.com",
        "q11.cnzz.com",
        "thy.dacedsfa.cn",
        "xg.whsbpw.cn",
        "s19.cnzz.com",
        "z8.cnzz.com",
        "s4.cnzz.com",
        "f5w.as12df.top",
        "ae01.alicdn.com",
        "www.92424.cn",
        "k.wudejia.com",
        "vivovip.mmszxc.top",
        "qiu.xixiqiu.com",
        "cdnjs.hnfenxun.com",
        "cms.qdwght.com"
      ]
    };

    // 根據format參數返回不同格式
    if (format === 'txt') {
      // 返回base64編碼的配置（TVBox常用格式）
      const configStr = JSON.stringify(tvboxConfig, null, 2);
      const base64Config = Buffer.from(configStr).toString('base64');
      
      return new NextResponse(base64Config, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } else {
      // 返回JSON格式
      return NextResponse.json(tvboxConfig, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

  } catch (error) {
    return NextResponse.json(
      { error: 'TVBox配置產生失敗', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// 支援CORS預檢請求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
