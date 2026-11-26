/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Sparkles,
  Settings,
  Image as ImageIcon,
  Edit3,
  Layout,
  Palette,
  RefreshCw,
  FileText,
  Check,
  Upload,
  X,
  MoveUp,
  MoveDown,
  Camera,
  Calendar,
  MapPin,
  Eye,
  Layers,
  HelpCircle,
  AlertTriangle,
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import jsPDF from 'jspdf';

export interface PhotoItem {
  id: string;
  url: string;
  title: string;
  description: string;
  date?: string;
  location?: string;
  layout: 'polaroid' | 'classic' | 'minimal';
}

export interface AlbumConfig {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  closingMessage: string;
  theme: 'classic' | 'modern' | 'vintage' | 'pastel' | 'dark';
  font: 'gothic' | 'myeongjo' | 'handwriting';
  spreadMode: boolean;
}

const SAMPLE_PHOTOS: PhotoItem[] = [
  {
    id: 'sample-1',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    title: '푸른 바다와 햇살',
    description: '끝없이 펼쳐진 에메랄드빛 바다와 따스한 모래사장에서 보낸 잊지 못할 오후의 휴식.',
    date: '2026-07-15',
    location: '하와이 마우이 해변',
    layout: 'classic'
  },
  {
    id: 'sample-2',
    url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
    title: '안개 낀 산맥 트레킹',
    description: '새벽 안개를 뚫고 올라선 정상에서 마주한 대자연의 경이로운 순간과 고요함.',
    date: '2026-08-20',
    location: '스위스 알프스',
    layout: 'polaroid'
  },
  {
    id: 'sample-3',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
    title: '별이 빛나는 밤하늘',
    description: '도시의 불빛을 벗어나 마주한 은하수. 밤하늘을 수놓은 수많은 별들이 마음을 설레게 했다.',
    date: '2026-09-10',
    location: '몽골 초원',
    layout: 'minimal'
  },
  {
    id: 'sample-4',
    url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&q=80',
    title: '유럽 골목길의 카페',
    description: '오래된 돌담길 옆 작은 테라스에서 마신 따뜻한 에스프레소와 여유로운 오후 시간.',
    date: '2026-10-05',
    location: '이탈리아 피렌체',
    layout: 'classic'
  }
];

export default function App() {
  const [photos, setPhotos] = useState<PhotoItem[]>(() => {
    try {
      const saved = localStorage.getItem('photobook_photos');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load photos from localStorage', e);
    }
    return SAMPLE_PHOTOS;
  });

  const [albumConfig, setAlbumConfig] = useState<AlbumConfig>(() => {
    try {
      const saved = localStorage.getItem('photobook_config');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load config from localStorage', e);
    }
    return {
      title: '나의 소중한 순간들',
      subtitle: 'Memorable Journey & Stories',
      author: '포토그래퍼',
      date: new Date().toISOString().split('T')[0],
      closingMessage: '소중한 순간들과 함께해주셔서 감사합니다. 이 앨범이 당신의 기억 속에 아름답게 남기를 바랍니다.',
      theme: 'classic',
      font: 'gothic',
      spreadMode: false
    };
  });

  const [currentPage, setCurrentPage] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'view' | 'edit' | 'settings'>('view');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('photobook_photos', JSON.stringify(photos));
      setStorageError(null);
    } catch (err: any) {
      console.error('LocalStorage quota exceeded:', err);
      setStorageError('브라우저 저장 공간(LocalStorage) 용량이 부족하여 일부 사진이 브라우저에 자동 저장되지 못했습니다.');
    }
  }, [photos]);

  useEffect(() => {
    try {
      localStorage.setItem('photobook_config', JSON.stringify(albumConfig));
    } catch (err) {
      console.error('LocalStorage config save error:', err);
    }
  }, [albumConfig]);

  const totalPages = photos.length + 2;

  const ensureBase64Image = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return url;
    }
  };

  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressedUrl = await processImageFile(file);
        const newPhoto: PhotoItem = {
          id: 'photo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          url: compressedUrl,
          title: file.name.replace(/\.[^/.]+$/, ''),
          description: '이 사진에 대한 설명을 입력하세요.',
          date: new Date().toISOString().split('T')[0],
          location: '장소 입력',
          layout: 'classic'
        };
        setPhotos((prev) => [...prev, newPhoto]);
      } catch (err) {
        console.error('Error processing image:', err);
      }
    }
    e.target.value = '';
  };

  const addSamplePhotos = async () => {
    setIsExporting(true);
    setExportProgress('샘플 사진 로딩 중...');
    try {
      const processedSamples = await Promise.all(
        SAMPLE_PHOTOS.map(async (p) => ({
          ...p,
          url: await ensureBase64Image(p.url)
        }))
      );
      setPhotos(processedSamples);
      setCurrentPage(0);
      setStorageError(null);
    } catch (e) {
      setPhotos(SAMPLE_PHOTOS);
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  const clearAllPhotos = () => {
    if (confirm('모든 사진을 삭제하시겠습니까?')) {
      setPhotos([]);
      setCurrentPage(0);
      setStorageError(null);
    }
  };

  const removePhoto = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPhotos(prev => prev.filter(p => p.id !== id));
    if (currentPage > photos.length - 1 && currentPage > 0) {
      setCurrentPage(Math.max(0, photos.length - 2));
    }
  };

  const movePhoto = (index: number, direction: 'up' | 'down', e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;
    const updated = [...photos];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setPhotos(updated);
  };

  const updatePhotoDetail = (id: string, field: keyof PhotoItem, value: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const generateAICaption = async (photo: PhotoItem) => {
    setAiLoadingId(photo.id);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        alert('Gemini API Key가 설정되지 않았습니다.');
        setAiLoadingId(null);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      let imagePart = null;
      if (photo.url.startsWith('data:image')) {
        const match = photo.url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          imagePart = {
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          };
        }
      }

      const prompt = `이 사진을 보고 감성적인 제목과 1~2문장의 따뜻하고 서정적인 설명(캡션)을 작성해줘. 
JSON 형식으로 답변해줘:
{
  "title": "사진 제목",
  "description": "감성적인 설명문"
}`;

      const contents = imagePart ? [imagePart, prompt] : [prompt + ` (사진 제목: ${photo.title})`];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setPhotos(prev => prev.map(p => p.id === photo.id ? {
          ...p,
          title: parsed.title || p.title,
          description: parsed.description || p.description
        } : p));
      } else {
        setPhotos(prev => prev.map(p => p.id === photo.id ? {
          ...p,
          description: text.trim()
        } : p));
      }
    } catch (err) {
      console.error(err);
      alert('AI 캡션 생성 중 오류가 발생했습니다.');
    } finally {
      setAiLoadingId(null);
    }
  };

  // Font family mapping helper
  const getFontFamilyCSS = () => {
    switch (albumConfig.font) {
      case 'myeongjo':
        return "'Noto Serif KR', serif";
      case 'handwriting':
        return "'Nanum Pen Script', cursive";
      case 'gothic':
      default:
        return "'Noto Sans KR', sans-serif";
    }
  };

  const getCanvasFontName = () => {
    switch (albumConfig.font) {
      case 'myeongjo':
        return 'serif';
      case 'handwriting':
        return 'Nanum Pen Script';
      case 'gothic':
      default:
        return 'sans-serif';
    }
  };

  // Pure 2D Canvas PDF Export matching cover, photos, and closing message with selected font
  const exportToPDF = async () => {
    setIsExporting(true);
    setExportProgress('PDF 변환 준비 중...');

    try {
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const canvasWidth = 1400;
      const canvasHeight = 990;

      const tHex = getThemeHexStyles();
      const fontName = getCanvasFontName();

      for (let i = 0; i < totalPages; i++) {
        setExportProgress(`페이지 ${i + 1} / ${totalPages} 생성 중...`);
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.fillStyle = tHex.pageBg;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (i === 0) {
          // Cover Page
          ctx.fillStyle = tHex.text;
          ctx.textAlign = 'center';

          ctx.strokeStyle = tHex.subText;
          ctx.lineWidth = 2;
          ctx.strokeRect(60, 60, canvasWidth - 120, canvasHeight - 120);

          ctx.font = `16px ${fontName}`;
          ctx.fillStyle = tHex.subText;
          ctx.fillText('PHOTOBOOK STUDIO', canvasWidth / 2, 160);

          ctx.font = `bold 56px ${fontName}`;
          ctx.fillStyle = tHex.text;
          ctx.fillText(albumConfig.title, canvasWidth / 2, canvasHeight / 2 - 50, 1000);

          ctx.font = `24px ${fontName}`;
          ctx.fillStyle = tHex.subText;
          ctx.fillText(albumConfig.subtitle, canvasWidth / 2, canvasHeight / 2 + 30, 1000);

          ctx.font = `18px ${fontName}`;
          ctx.fillStyle = tHex.text;
          ctx.fillText(`지은이: ${albumConfig.author}`, canvasWidth / 2, canvasHeight - 180);

          if (albumConfig.date) {
            ctx.font = `16px ${fontName}`;
            ctx.fillStyle = tHex.subText;
            ctx.fillText(albumConfig.date, canvasWidth / 2, canvasHeight - 140);
          }
        } else if (i > 0 && i <= photos.length) {
          // Photo Page
          const photo = photos[i - 1];

          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            img.src = photo.url;
          });

          const boxX = 80;
          const boxY = 80;
          const boxW = 600;
          const boxH = canvasHeight - 160;

          if (img.width > 0 && img.height > 0) {
            const scale = Math.min(boxW / img.width, boxH / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = boxX + (boxW - w) / 2;
            const y = boxY + (boxH - h) / 2;

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 20;
            ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
            ctx.shadowBlur = 0;

            ctx.drawImage(img, x, y, w, h);
          }

          const textX = 740;
          let textY = 200;

          ctx.textAlign = 'left';
          ctx.font = `16px ${fontName}`;
          ctx.fillStyle = tHex.subText;
          const metaText = [photo.date, photo.location].filter(Boolean).join(' · ');
          if (metaText) {
            ctx.fillText(metaText, textX, textY);
            textY += 40;
          }

          ctx.font = `bold 36px ${fontName}`;
          ctx.fillStyle = tHex.text;
          ctx.fillText(photo.title, textX, textY, 580);
          textY += 60;

          ctx.font = albumConfig.font === 'handwriting' ? `26px ${fontName}` : `20px ${fontName}`;
          ctx.fillStyle = tHex.text;
          const words = photo.description.split('');
          let line = '';
          const maxWidth = 560;
          const lineHeight = 36;

          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
              ctx.fillText(line, textX, textY);
              line = words[n];
              textY += lineHeight;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, textX, textY);

          ctx.font = `14px ${fontName}`;
          ctx.fillStyle = tHex.subText;
          ctx.fillText(`Page ${i} of ${photos.length}`, textX, canvasHeight - 80);
        } else {
          // Back Cover
          ctx.fillStyle = tHex.text;
          ctx.textAlign = 'center';

          ctx.font = `bold 40px ${fontName}`;
          ctx.fillText('The End', canvasWidth / 2, canvasHeight / 2 - 60);

          ctx.font = albumConfig.font === 'handwriting' ? `26px ${fontName}` : `22px ${fontName}`;
          ctx.fillStyle = tHex.subText;
          const msg = albumConfig.closingMessage;
          ctx.fillText(msg, canvasWidth / 2, canvasHeight / 2 + 10, 1000);

          ctx.font = `16px ${fontName}`;
          ctx.fillText(`${albumConfig.title} · ${albumConfig.author}`, canvasWidth / 2, canvasHeight - 120);
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        if (i > 0) {
          pdf.addPage('a4', 'landscape');
        }

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      setExportProgress('PDF 파일 다운로드 생성 중...');
      pdf.save(`${albumConfig.title.replace(/\s+/g, '_')}_포토북.pdf`);
    } catch (err) {
      console.error(err);
      alert('PDF 내보내기 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  const getThemeHexStyles = () => {
    switch (albumConfig.theme) {
      case 'modern':
        return {
          bg: '#f8fafc',
          text: '#0f172a',
          pageBg: '#ffffff',
          pageBorder: '#e2e8f0',
          subText: '#64748b'
        };
      case 'vintage':
        return {
          bg: '#f4efe6',
          text: '#3d3529',
          pageBg: '#fcf9f2',
          pageBorder: '#d9ceb8',
          subText: '#5c5040'
        };
      case 'pastel':
        return {
          bg: '#fdf2f8',
          text: '#1e293b',
          pageBg: '#ffffff',
          pageBorder: '#fce7f3',
          subText: '#64748b'
        };
      case 'dark':
        return {
          bg: '#020617',
          text: '#f8fafc',
          pageBg: '#0f172a',
          pageBorder: '#1e293b',
          subText: '#94a3b8'
        };
      case 'classic':
      default:
        return {
          bg: '#fcfbf9',
          text: '#292524',
          pageBg: '#ffffff',
          pageBorder: '#e7e5e4',
          subText: '#78716c'
        };
    }
  };

  const tHex = getThemeHexStyles();
  const currentFontFamily = getFontFamilyCSS();

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-500 select-none"
      style={{ backgroundColor: tHex.bg, color: tHex.text, fontFamily: currentFontFamily }}
    >
      {storageError && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2 max-w-5xl mx-auto">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{storageError}</span>
          </div>
          <button onClick={() => setStorageError(null)} className="p-1 hover:bg-amber-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-black/10 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-stone-900 text-white shadow-sm">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{albumConfig.title}</h1>
            <p className="text-xs text-slate-500">{photos.length}장의 추억 · {albumConfig.author}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('view')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'view' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>앨범 보기</span>
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'edit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>사진 및 편집 ({photos.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>앨범 설정</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all flex items-center space-x-2">
            <Upload className="w-4 h-4" />
            <span>사진 추가</span>
            <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
          <button
            onClick={exportToPDF}
            disabled={isExporting || photos.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? '변환 중...' : 'PDF 저장'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 relative overflow-x-hidden">
        {activeTab === 'view' && (
          <div className="w-full max-w-6xl flex flex-col items-center">
            {photos.length === 0 ? (
              <div className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300 p-12 max-w-lg w-full shadow-sm text-slate-800">
                <ImageIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">등록된 사진이 없습니다</h3>
                <p className="text-sm text-slate-500 mb-6">사진을 업로드하거나 샘플 앨범을 불러와서 멋진 포토북을 만들어보세요.</p>
                <div className="flex justify-center space-x-3">
                  <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm shadow-md transition-all cursor-pointer flex items-center space-x-2">
                    <Upload className="w-4 h-4" />
                    <span>사진 업로드하기</span>
                    <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button
                    onClick={addSamplePhotos}
                    disabled={isExporting}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>샘플 앨범 보기</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="w-full flex justify-center items-center my-4">
                  <div
                    id="book-page-container"
                    className="w-full max-w-5xl aspect-[1.414/1] rounded-2xl overflow-hidden p-8 md:p-12 relative flex transition-all duration-300 shadow-2xl"
                    style={{
                      backgroundColor: tHex.pageBg,
                      color: tHex.text,
                      border: `1px solid ${tHex.pageBorder}`,
                      fontFamily: currentFontFamily
                    }}
                  >
                    {currentPage === 0 && (
                      <div className="w-full h-full flex flex-col justify-between items-center text-center p-8 md:p-16 relative">
                        <div className="absolute inset-6 border-2 border-dashed border-current opacity-20 rounded-xl pointer-events-none" />
                        <div className="mt-8">
                          <span className="text-xs uppercase tracking-widest px-4 py-1.5 bg-black/5 rounded-full font-semibold">
                            PHOTOBOOK STUDIO
                          </span>
                        </div>
                        <div className="max-w-2xl space-y-4 my-auto">
                          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
                            {albumConfig.title}
                          </h1>
                          <p className="text-lg md:text-2xl opacity-80 font-light">
                            {albumConfig.subtitle}
                          </p>
                        </div>
                        <div className="mb-6 space-y-1">
                          <p className="text-base font-semibold opacity-90">지은이: {albumConfig.author}</p>
                          {albumConfig.date && <p className="text-xs opacity-60">{albumConfig.date}</p>}
                        </div>
                      </div>
                    )}

                    {currentPage > 0 && currentPage <= photos.length && (
                      <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="w-full h-full flex items-center justify-center bg-black/5 rounded-xl overflow-hidden p-4 relative group">
                          {photos[currentPage - 1].layout === 'polaroid' ? (
                            <div className="bg-white text-slate-800 p-4 pb-8 shadow-xl rotate-[-1deg] max-h-full flex flex-col items-center">
                              <img
                                src={photos[currentPage - 1].url}
                                alt={photos[currentPage - 1].title}
                                className="max-h-[50vh] md:max-h-[60vh] object-contain shadow-xs"
                                crossOrigin="anonymous"
                              />
                              <p className="mt-4 font-serif text-sm text-slate-800 font-semibold tracking-wider">
                                {photos[currentPage - 1].title}
                              </p>
                            </div>
                          ) : photos[currentPage - 1].layout === 'minimal' ? (
                            <div className="w-full h-full flex items-center justify-center p-2">
                              <img
                                src={photos[currentPage - 1].url}
                                alt={photos[currentPage - 1].title}
                                className="max-h-[65vh] w-full object-cover rounded-lg shadow-md"
                                crossOrigin="anonymous"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full border-8 border-white shadow-xl bg-white flex items-center justify-center overflow-hidden rounded-md">
                              <img
                                src={photos[currentPage - 1].url}
                                alt={photos[currentPage - 1].title}
                                className="max-h-[65vh] w-full object-contain"
                                crossOrigin="anonymous"
                              />
                            </div>
                          )}
                        </div>

                        <div className="w-full h-full flex flex-col justify-center px-6 md:px-10 space-y-6">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3 text-xs opacity-70 font-medium" style={{ color: tHex.subText }}>
                              {photos[currentPage - 1].date && (
                                <span className="flex items-center space-x-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{photos[currentPage - 1].date}</span>
                                </span>
                              )}
                              {photos[currentPage - 1].location && (
                                <span className="flex items-center space-x-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span>{photos[currentPage - 1].location}</span>
                                </span>
                              )}
                            </div>
                            <h2 className="text-2xl md:text-4xl font-bold leading-snug">
                              {photos[currentPage - 1].title}
                            </h2>
                          </div>

                          <div className={`text-base md:text-lg leading-relaxed whitespace-pre-wrap opacity-90 border-l-2 pl-4 ${albumConfig.font === 'handwriting' ? 'text-xl' : ''}`} style={{ borderColor: tHex.subText }}>
                            {photos[currentPage - 1].description}
                          </div>

                          <div className="pt-4 flex items-center justify-between text-xs opacity-50 border-t" style={{ borderColor: tHex.pageBorder }}>
                            <span>Page {currentPage} of {photos.length}</span>
                            <span>{albumConfig.title}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentPage === photos.length + 1 && (
                      <div className="w-full h-full flex flex-col justify-center items-center text-center p-12 space-y-6">
                        <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-2">
                          <BookOpen className="w-8 h-8 opacity-60" />
                        </div>
                        <h2 className="text-3xl font-bold">The End</h2>
                        <p className={`text-base md:text-xl opacity-85 max-w-xl leading-relaxed ${albumConfig.font === 'handwriting' ? 'text-2xl' : ''}`}>
                          {albumConfig.closingMessage}
                        </p>
                        <div className="pt-8 text-xs opacity-50">
                          {albumConfig.title} · {albumConfig.author}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between w-full max-w-5xl mt-6 px-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-800 font-medium shadow-md border border-slate-200 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span>이전 페이지</span>
                  </button>

                  <div className="text-sm font-semibold text-slate-700 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
                    {currentPage === 0 ? '표지 (Cover)' : currentPage === totalPages - 1 ? '뒷표지 (Back Cover)' : `${currentPage} / ${photos.length}`}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-800 font-medium shadow-md border border-slate-200 transition-all cursor-pointer"
                  >
                    <span>다음 페이지</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="w-full max-w-5xl mt-8 flex items-center space-x-3 overflow-x-auto pb-4 pt-2 px-2 scrollbar-thin">
                  <button
                    onClick={() => setCurrentPage(0)}
                    className={`flex-shrink-0 w-16 h-20 rounded-lg border-2 overflow-hidden bg-slate-900 text-white flex flex-col items-center justify-center text-xs font-medium transition-all ${
                      currentPage === 0 ? 'ring-2 ring-indigo-600 border-indigo-600 scale-105' : 'border-slate-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span>표지</span>
                  </button>

                  {photos.map((photo, idx) => (
                    <button
                      key={photo.id}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden relative group transition-all ${
                        currentPage === idx + 1 ? 'ring-2 ring-indigo-600 border-indigo-600 scale-105 shadow-md' : 'border-slate-300 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] text-center truncate px-1 py-0.5">
                        {idx + 1}. {photo.title}
                      </div>
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(totalPages - 1)}
                    className={`flex-shrink-0 w-16 h-20 rounded-lg border-2 overflow-hidden bg-slate-900 text-white flex flex-col items-center justify-center text-xs font-medium transition-all ${
                      currentPage === totalPages - 1 ? 'ring-2 ring-indigo-600 border-indigo-600 scale-105' : 'border-slate-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span>뒷표지</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="w-full max-w-5xl space-y-6 pb-12">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">사진 관리 및 편집</h2>
                <p className="text-sm text-slate-500">각 사진의 제목, 설명, 촬영일자 및 레이아웃을 자유롭게 편집하세요.</p>
              </div>
              <div className="flex items-center space-x-3">
                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all flex items-center space-x-2">
                  <Upload className="w-4 h-4" />
                  <span>사진 추가하기</span>
                  <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                {photos.length > 0 && (
                  <button
                    onClick={clearAllPhotos}
                    className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>전체 삭제</span>
                  </button>
                )}
              </div>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">등록된 사진이 없습니다. 사진을 추가해주세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {photos.map((photo, index) => (
                  <div key={photo.id} className="bg-white text-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-full md:w-64 flex-shrink-0 flex flex-col items-center space-y-3">
                      <div className="w-full h-48 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative group">
                        <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md font-semibold">
                          #{index + 1}
                        </div>
                      </div>
                      <div className="flex items-center justify-between w-full px-1">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => movePhoto(index, 'up', e)}
                            disabled={index === 0}
                            title="위로 이동"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 cursor-pointer"
                          >
                            <MoveUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => movePhoto(index, 'down', e)}
                            disabled={index === photos.length - 1}
                            title="아래로 이동"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 cursor-pointer"
                          >
                            <MoveDown className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={(e) => removePhoto(photo.id, e)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 flex items-center space-x-1 text-xs font-medium cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>삭제</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 mr-4">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">사진 제목</label>
                          <input
                            type="text"
                            value={photo.title}
                            onChange={(e) => updatePhotoDetail(photo.id, 'title', e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-semibold text-base"
                            placeholder="제목을 입력하세요"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">레이아웃</label>
                          <select
                            value={photo.layout}
                            onChange={(e) => updatePhotoDetail(photo.id, 'layout', e.target.value as any)}
                            className="px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm bg-white"
                          >
                            <option value="classic">클래식 프레임</option>
                            <option value="polaroid">폴라로이드</option>
                            <option value="minimal">미니멀 풀블리드</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">촬영 날짜</label>
                          <input
                            type="date"
                            value={photo.date || ''}
                            onChange={(e) => updatePhotoDetail(photo.id, 'date', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">촬영 장소</label>
                          <input
                            type="text"
                            value={photo.location || ''}
                            onChange={(e) => updatePhotoDetail(photo.id, 'location', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm"
                            placeholder="예: 서울 남산타워"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">상세 설명 / 캡션</label>
                          <button
                            onClick={() => generateAICaption(photo)}
                            disabled={aiLoadingId === photo.id}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{aiLoadingId === photo.id ? 'AI 작성 중...' : 'AI 캡션 자동 생성'}</span>
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={photo.description}
                          onChange={(e) => updatePhotoDetail(photo.id, 'description', e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 text-sm leading-relaxed"
                          placeholder="이 사진에 대한 추억이나 감상을 적어보세요..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">앨범 설정</h2>
              <p className="text-sm text-slate-500">글꼴, 표지 정보, 디자인 테마를 맞춤 설정하세요.</p>
            </div>

            <div className="space-y-6">
              {/* Font Selection Buttons (3 buttons: Gothic / Myeongjo / Handwriting) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Type className="w-4 h-4 text-indigo-600" />
                  <span>글꼴 스타일 선택</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'gothic', name: '고딕 (깔끔함)', fontStyle: "'Noto Sans KR', sans-serif" },
                    { id: 'myeongjo', name: '명조 (우아함)', fontStyle: "'Noto Serif KR', serif" },
                    { id: 'handwriting', name: '손글씨 (감성적)', fontStyle: "'Nanum Pen Script', cursive" }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setAlbumConfig({ ...albumConfig, font: f.id as any })}
                      className={`py-3 px-4 rounded-xl border-2 font-medium transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                        albumConfig.font === f.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                      style={{ fontFamily: f.fontStyle }}
                    >
                      <span className="text-base">{f.name.split(' ')[0]}</span>
                      <span className="text-xs opacity-60 font-sans">{f.name.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">앨범 제목 (표지)</label>
                <input
                  type="text"
                  value={albumConfig.title}
                  onChange={(e) => setAlbumConfig({ ...albumConfig, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900 text-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">부제 / 소제목 (표지)</label>
                <input
                  type="text"
                  value={albumConfig.subtitle}
                  onChange={(e) => setAlbumConfig({ ...albumConfig, subtitle: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">지은이 / 저자</label>
                  <input
                    type="text"
                    value={albumConfig.author}
                    onChange={(e) => setAlbumConfig({ ...albumConfig, author: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">발행 날짜</label>
                  <input
                    type="date"
                    value={albumConfig.date}
                    onChange={(e) => setAlbumConfig({ ...albumConfig, date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">마무리 문구 (마지막 쪽)</label>
                <textarea
                  rows={3}
                  value={albumConfig.closingMessage}
                  onChange={(e) => setAlbumConfig({ ...albumConfig, closingMessage: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm leading-relaxed"
                  placeholder="마지막 장에 들어갈 마무리 인사를 입력하세요..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">디자인 테마</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { id: 'classic', name: '클래식 크림', color: 'bg-[#fcfbf9] border-stone-300 text-stone-800' },
                    { id: 'modern', name: '모던 화이트', color: 'bg-white border-slate-300 text-slate-900' },
                    { id: 'vintage', name: '빈티지 세피아', color: 'bg-[#f4efe6] border-[#d9ceb8] text-[#3d3529]' },
                    { id: 'pastel', name: '파스텔 핑크', color: 'bg-pink-50 border-pink-200 text-pink-900' },
                    { id: 'dark', name: '다크 나이트', color: 'bg-slate-950 border-slate-800 text-slate-100' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setAlbumConfig({ ...albumConfig, theme: t.id as any })}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${t.color} ${
                        albumConfig.theme === t.id ? 'ring-2 ring-indigo-600 border-indigo-600 scale-105 shadow-md' : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <span className="text-xs font-bold">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveTab('view')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm shadow-md transition-all cursor-pointer"
              >
                저장 및 앨범으로 돌아가기
              </button>
            </div>
          </div>
        )}
      </main>

      {isExporting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">PDF 문서 생성 중</h3>
            <p className="text-sm text-slate-500">{exportProgress}</p>
          </div>
        </div>
      )}
    </div>
  );
}
