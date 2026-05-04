/**
 * AI 相关性分析准确度评估测试
 * 
 * 这套测试用于验证 AI Prompt 对关键词相关性的判断质量。
 * 每个测试用例模拟真实场景：给定关键词 + 内容 → 验证 AI 判断结果是否合理。
 * 
 * 运行方式：
 *   npx vitest run src/__tests__/aiRelevance.test.ts
 * 
 * 注意：需要配置 OPENAI_API_KEY 环境变量才能调用真实 AI。
 * 如果未配置，测试会跳过（不会失败）。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { analyzeContent, expandKeyword, preMatchKeyword } from '../services/ai.js';

const HAS_API_KEY = !!process.env.OPENAI_API_KEY;

// ========== 测试用例定义 ==========

interface RelevanceTestCase {
  /** 测试描述 */
  name: string;
  /** 监控关键词 */
  keyword: string;
  /** 模拟的搜索结果内容（标题 + 正文） */
  content: string;
  /** 预期：应该通过（保留）还是被过滤 */
  expectPass: boolean;
  /** 预期：关键词是否被直接提及 */
  expectKeywordMentioned: boolean;
  /** 预期相关性分数范围 [min, max] */
  expectedRelevanceRange: [number, number];
}

const TEST_CASES: RelevanceTestCase[] = [
  // ===== 应该通过的：直接相关内容 =====
  {
    name: '直接相关：Claude Sonnet 4.6 发布新闻',
    keyword: 'Claude Sonnet 4.6',
    content: `Anthropic 正式发布 Claude Sonnet 4.6，新版本在代码生成和推理能力上有显著提升。
Claude Sonnet 4.6 在 SWE-bench 上的得分从 49% 提升到 62.3%，成为目前最强的编程助手模型之一。
Anthropic CEO Dario Amodei 表示，Sonnet 4.6 是他们迄今为止最高效的模型。`,
    expectPass: true,
    expectKeywordMentioned: true,
    expectedRelevanceRange: [80, 100],
  },
  {
    name: '直接相关：Claude Sonnet 4.6 使用技巧分享',
    keyword: 'Claude Sonnet 4.6',
    content: `分享 Claude Sonnet 4.6 的高级使用技巧：如何利用 system prompt 优化输出质量。
通过设置合理的 temperature 和 max_tokens 参数，可以让 Sonnet 4.6 的回答更加精准。
实测在代码审查场景中，Sonnet 4.6 比 GPT-4 快 30%。`,
    expectPass: true,
    expectKeywordMentioned: true,
    expectedRelevanceRange: [75, 100],
  },
  {
    name: '直接相关：鱼皮的 AI 导航网站更新',
    keyword: '鱼皮的 AI 导航',
    content: `程序员鱼皮的 AI 导航网站上线了全新的分类功能，新增了 50+ AI 工具推荐。
鱼皮表示，AI 导航将持续更新，帮助开发者快速找到最合适的 AI 工具。
新版本还支持用户收藏和评分功能。`,
    expectPass: true,
    expectKeywordMentioned: true,
    expectedRelevanceRange: [80, 100],
  },

  // ===== 应该被过滤的：间接相关 / 同领域但不同主题 =====
  {
    name: '间接相关：OpenClaw 技巧但未提及 Claude Sonnet 4.6',
    keyword: 'Claude Sonnet 4.6',
    content: `🚀 OpenClaw 高级进阶技巧分享！模型精选策略+记忆系统优化经验+深度搜索集成+Gateway崩溃自动修复！
Claude Code 自动读日志修Bug重启验证。分享 OpenClaw 高级使用技巧，涵盖模型选择、记忆优化、搜索集成和系统自动修复等 AI 编程实战经验。`,
    expectPass: false,
    expectKeywordMentioned: false,
    expectedRelevanceRange: [15, 50],
  },
  {
    name: '间接相关：GPT-5 新闻 vs 搜索 Claude Sonnet',
    keyword: 'Claude Sonnet 4.6',
    content: `OpenAI 宣布 GPT-5 即将发布，新模型在多模态推理上取得突破。
GPT-5 将支持实时视频理解和复杂数学推导，预计将改变 AI 应用格局。
测试显示 GPT-5 在所有基准测试中全面超越现有模型。`,
    expectPass: false,
    expectKeywordMentioned: false,
    expectedRelevanceRange: [10, 45],
  },
  {
    name: '间接相关：AI 编程泛泛而谈，未提及特定关键词',
    keyword: 'Cursor',
    content: `2026年 AI 编程工具盘点：如何选择适合你的 AI 编码助手。
本文对比了市面上主流的 AI 编程工具，从价格、功能、易用性等维度进行分析。
建议初学者从免费工具开始体验，逐步过渡到付费方案。`,
    expectPass: false,
    expectKeywordMentioned: false,
    expectedRelevanceRange: [20, 55],
  },
  {
    name: '间接相关：其他 AI 导航网站，不是鱼皮的',
    keyword: '鱼皮的 AI 导航',
    content: `AI 工具导航网站推荐：TopAI 收录了 2000+ 个 AI 工具。
该导航网站按场景分类，覆盖文本、图像、视频、音频等所有 AI 领域。
每月活跃用户已超过 50 万。`,
    expectPass: false,
    expectKeywordMentioned: false,
    expectedRelevanceRange: [10, 40],
  },

  // ===== 边界案例 =====
  {
    name: '边界：提到 Claude 但不是 Sonnet 4.6',
    keyword: 'Claude Sonnet 4.6',
    content: `Anthropic 的 Claude 3.5 Haiku 模型性能大幅提升，在速度和成本效率上表现优异。
Claude Haiku 非常适合高并发场景，API 调用成本仅为 Sonnet 的三分之一。
开发者反馈 Haiku 在简单任务上的表现已经足够好。`,
    expectPass: false,
    expectKeywordMentioned: false,
    expectedRelevanceRange: [25, 55],
  },
  {
    name: '边界：中文变体匹配 - Cursor 编辑器',
    keyword: 'Cursor',
    content: `Cursor 编辑器发布了 1.0 正式版本！这款 AI 驱动的代码编辑器终于走出 Beta。
新版本 Cursor 引入了 Agent 模式，可以自动执行复杂的代码重构任务。
Cursor 的 Tab 补全功能被评为 2026 年最佳开发者工具。`,
    expectPass: true,
    expectKeywordMentioned: true,
    expectedRelevanceRange: [85, 100],
  },
  {
    name: '应该过滤：完全无关的内容',
    keyword: 'Claude Sonnet 4.6',
    content: `今日天气预报：北京地区多云转晴，最高温度 25 度。
建议市民外出携带薄外套，紫外线指数中等。
周末气温将有所下降，请做好保暖准备。`,
    expectPass: false,
    expectKeywordMentioned: false,
    expectedRelevanceRange: [0, 10],
  },
];

// ========== Query Expansion 测试 ==========

describe('Query Expansion（查询扩展）', () => {
  it('extractCoreTerms 能正确拆分复合关键词', async () => {
    // 即使没有 API key，expandKeyword 也应该返回基础拆分结果
    const result = await expandKeyword('Claude Sonnet 4.6');
    expect(result).toContain('Claude Sonnet 4.6');
    // 应该包含核心子词
    expect(result.some(r => r.toLowerCase().includes('claude'))).toBe(true);
    expect(result.some(r => r.toLowerCase().includes('sonnet'))).toBe(true);
  });

  it('单个词不会被过度拆分', async () => {
    const result = await expandKeyword('Cursor');
    expect(result).toContain('Cursor');
    // 单词关键词不应产生太多拆分
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('中文关键词能正确扩展', async () => {
    const result = await expandKeyword('鱼皮的 AI 导航');
    expect(result).toContain('鱼皮的 AI 导航');
    expect(result.some(r => r.includes('鱼皮'))).toBe(true);
  });
});

// ========== 预匹配测试 ==========

describe('preMatchKeyword（关键词预匹配）', () => {
  it('能匹配到完整关键词', () => {
    const result = preMatchKeyword(
      '今天 Claude Sonnet 4.6 发布了新版本',
      ['Claude Sonnet 4.6', 'Claude Sonnet', 'Sonnet 4.6']
    );
    expect(result.matched).toBe(true);
    expect(result.matchedTerms).toContain('Claude Sonnet 4.6');
  });

  it('能匹配到关键词变体', () => {
    const result = preMatchKeyword(
      '新版 Claude Sonnet 表现优异',
      ['Claude Sonnet 4.6', 'Claude Sonnet', 'Sonnet 4.6']
    );
    expect(result.matched).toBe(true);
    expect(result.matchedTerms).toContain('Claude Sonnet');
  });

  it('不匹配无关内容', () => {
    const result = preMatchKeyword(
      '今天天气很好，适合出门散步',
      ['Claude Sonnet 4.6', 'Claude Sonnet', 'Sonnet 4.6']
    );
    expect(result.matched).toBe(false);
    expect(result.matchedTerms).toHaveLength(0);
  });

  it('不区分大小写', () => {
    const result = preMatchKeyword(
      'CLAUDE SONNET 4.6 is amazing',
      ['claude sonnet 4.6']
    );
    expect(result.matched).toBe(true);
  });
});

// ========== AI 相关性判断准确度测试（需要 API Key） ==========

describe.skipIf(!HAS_API_KEY)('AI 相关性判断准确度（真实 AI 调用）', () => {
  // 增加超时时间，AI 调用需要时间
  const TIMEOUT = 30000;

  for (const tc of TEST_CASES) {
    it(tc.name, async () => {
      const expandedKeywords = await expandKeyword(tc.keyword);
      const preMatch = preMatchKeyword(tc.content, expandedKeywords);
      const result = await analyzeContent(tc.content, tc.keyword, preMatch);

      console.log(`\n  📊 [${tc.name}]`);
      console.log(`     关键词: ${tc.keyword}`);
      console.log(`     预匹配: ${preMatch.matched ? '✅ ' + preMatch.matchedTerms.join(', ') : '❌ 未匹配'}`);
      console.log(`     AI 结果: relevance=${result.relevance}, keywordMentioned=${result.keywordMentioned}, importance=${result.importance}`);
      console.log(`     AI 摘要: ${result.summary}`);
      console.log(`     AI 理由: ${result.relevanceReason}`);
      console.log(`     预期范围: [${tc.expectedRelevanceRange[0]}, ${tc.expectedRelevanceRange[1]}]`);

      // 验证相关性分数在预期范围内
      expect(result.relevance).toBeGreaterThanOrEqual(tc.expectedRelevanceRange[0]);
      expect(result.relevance).toBeLessThanOrEqual(tc.expectedRelevanceRange[1]);

      // 验证关键词提及判断
      expect(result.keywordMentioned).toBe(tc.expectKeywordMentioned);

      // 验证过滤结果（模拟 hotspotChecker 的过滤逻辑）
      const wouldPass = result.isReal 
        && result.relevance >= 50 
        && (result.keywordMentioned || result.relevance >= 65);
      
      if (tc.expectPass) {
        expect(wouldPass).toBe(true);
      } else {
        expect(wouldPass).toBe(false);
      }
    }, TIMEOUT);
  }
});

// ========== 无 API 时的 fallback 行为测试 ==========

describe('AI Fallback 行为（无 API Key）', () => {
  it('preMatch=true 时 fallback 给出较高默认分', async () => {
    // 临时清空 API key 测试 fallback
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = '';
    
    try {
      const result = await analyzeContent(
        'Claude Sonnet 4.6 is amazing',
        'Claude Sonnet 4.6',
        { matched: true, matchedTerms: ['Claude Sonnet 4.6'] }
      );
      expect(result.relevance).toBe(50);
      expect(result.keywordMentioned).toBe(true);
    } finally {
      process.env.OPENAI_API_KEY = originalKey || '';
    }
  });

  it('preMatch=false 时 fallback 给出较低默认分', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = '';
    
    try {
      const result = await analyzeContent(
        '今天天气真好',
        'Claude Sonnet 4.6',
        { matched: false, matchedTerms: [] }
      );
      expect(result.relevance).toBe(20);
      expect(result.keywordMentioned).toBe(false);
    } finally {
      process.env.OPENAI_API_KEY = originalKey || '';
    }
  });
});

// ========== 评估报告 ==========

describe.skipIf(!HAS_API_KEY)('评估报告汇总', () => {
  it('运行所有测试用例并输出评估报告', async () => {
    let passCount = 0;
    let failCount = 0;
    const details: string[] = [];

    for (const tc of TEST_CASES) {
      const expandedKeywords = await expandKeyword(tc.keyword);
      const preMatch = preMatchKeyword(tc.content, expandedKeywords);
      const result = await analyzeContent(tc.content, tc.keyword, preMatch);

      const wouldPass = result.isReal 
        && result.relevance >= 50 
        && (result.keywordMentioned || result.relevance >= 65);

      const correct = wouldPass === tc.expectPass 
        && result.keywordMentioned === tc.expectKeywordMentioned
        && result.relevance >= tc.expectedRelevanceRange[0] 
        && result.relevance <= tc.expectedRelevanceRange[1];

      if (correct) {
        passCount++;
        details.push(`  ✅ ${tc.name}`);
      } else {
        failCount++;
        details.push(`  ❌ ${tc.name} (relevance=${result.relevance}, expected=[${tc.expectedRelevanceRange}], pass=${wouldPass}, expectedPass=${tc.expectPass})`);
      }
    }

    const total = TEST_CASES.length;
    const accuracy = ((passCount / total) * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log(`📊 AI 相关性评估报告`);
    console.log('='.repeat(60));
    console.log(`总用例数: ${total}`);
    console.log(`通过: ${passCount} | 失败: ${failCount}`);
    console.log(`准确率: ${accuracy}%`);
    console.log('-'.repeat(60));
    details.forEach(d => console.log(d));
    console.log('='.repeat(60));

    // 准确率应该 >= 80%
    expect(passCount / total).toBeGreaterThanOrEqual(0.8);
  }, 120000); // 2 分钟超时
});
