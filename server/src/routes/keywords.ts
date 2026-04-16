import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

// 获取所有关键词
router.get('/', async (req, res) => {
  try {
    const keywords = await prisma.keyword.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { hotspots: true }
        }
      }
    });
    res.json(keywords);
  } catch (error) {
    console.error('Error fetching keywords:', error);
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// 获取关键词热点统计（需在 /:id 之前定义）
router.get('/:id/stats', async (req, res) => {
  try {
    const keyword = await prisma.keyword.findUnique({
      where: { id: req.params.id }
    });

    if (!keyword) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, byImportance, bySource] = await Promise.all([
      prisma.hotspot.count({ where: { keywordId: req.params.id } }),
      prisma.hotspot.count({ where: { keywordId: req.params.id, createdAt: { gte: today } } }),
      prisma.hotspot.groupBy({
        by: ['importance'],
        where: { keywordId: req.params.id },
        _count: { importance: true }
      }),
      prisma.hotspot.groupBy({
        by: ['source'],
        where: { keywordId: req.params.id },
        _count: { source: true }
      })
    ]);

    res.json({
      keywordId: keyword.id,
      keywordText: keyword.text,
      total,
      today: todayCount,
      byImportance: byImportance.reduce((acc: Record<string, number>, item) => {
        acc[item.importance] = item._count.importance;
        return acc;
      }, {}),
      bySource: bySource.reduce((acc: Record<string, number>, item) => {
        acc[item.source] = item._count.source;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching keyword stats:', error);
    res.status(500).json({ error: 'Failed to fetch keyword stats' });
  }
});

// 获取单个关键词
router.get('/:id', async (req, res) => {
  try {
    const keyword = await prisma.keyword.findUnique({
      where: { id: req.params.id },
      include: {
        hotspots: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!keyword) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    res.json(keyword);
  } catch (error) {
    console.error('Error fetching keyword:', error);
    res.status(500).json({ error: 'Failed to fetch keyword' });
  }
});

// 创建关键词
router.post('/', async (req, res) => {
  try {
    const { text, category } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Keyword text is required' });
    }

    if (text.trim().length > 100) {
      return res.status(400).json({ error: 'Keyword text must not exceed 100 characters' });
    }

    const keyword = await prisma.keyword.create({
      data: {
        text: text.trim(),
        category: category?.trim() || null
      }
    });

    res.status(201).json(keyword);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Keyword already exists' });
    }
    console.error('Error creating keyword:', error);
    res.status(500).json({ error: 'Failed to create keyword' });
  }
});

// 更新关键词
router.put('/:id', async (req, res) => {
  try {
    const { text, category, isActive } = req.body;

    const keyword = await prisma.keyword.update({
      where: { id: req.params.id },
      data: {
        ...(text && { text: text.trim() }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json(keyword);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    console.error('Error updating keyword:', error);
    res.status(500).json({ error: 'Failed to update keyword' });
  }
});

// 删除关键词
router.delete('/:id', async (req, res) => {
  try {
    await prisma.keyword.delete({
      where: { id: req.params.id }
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    console.error('Error deleting keyword:', error);
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

// 切换关键词状态
router.patch('/:id/toggle', async (req, res) => {
  try {
    const keyword = await prisma.keyword.findUnique({
      where: { id: req.params.id }
    });

    if (!keyword) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const updated = await prisma.keyword.update({
      where: { id: req.params.id },
      data: { isActive: !keyword.isActive }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error toggling keyword:', error);
    res.status(500).json({ error: 'Failed to toggle keyword' });
  }
});

export default router;
