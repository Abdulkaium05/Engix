import * as pdfjs from 'pdfjs-dist';

// Use a more stable worker source from unpkg for the preview environment
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface ResultData {
  rollNumber: string;
  semester: number;
  gpa: number | null;
  status: 'pass' | 'referred' | 'fail';
  referredSubjects?: string[];
  instituteName: string;
  instituteCode: string;
  regulation: string;
  batch: string;
  exam?: string;
  gpas?: Record<string, number | null>;
}

export async function parseBTEBPdf(
  file: File, 
  regulation: string, 
  semester: number, 
  batch: string,
  onProgress?: (progress: number) => void
): Promise<ResultData[]> {
  console.log("Starting PDF parse for:", file.name);
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const pdf = await pdfjs.getDocument({ 
      data: arrayBuffer,
      useWorkerFetch: true
    }).promise;
    
    const results: ResultData[] = [];
  
    let currentInstituteName = "Unknown Institute";
    let currentInstituteCode = "00000";
  
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      
      if (onProgress) {
        onProgress(Math.round((i / pdf.numPages) * 100));
      }

      // 1. Institute Detection
      const instMatch = pageText.match(/([A-Z\s,]+)\s\((\d{5})\)/);
      if (instMatch) {
        currentInstituteName = instMatch[1].trim();
        currentInstituteCode = instMatch[2];
      }

      // 2. Pattern for Passed Students (with all semester GPAs)
      // Supports 4-10 digit rolls and flexible spacing
      const passedPattern = /(\d{4,10})\s+\((?:gpa\d:\s*[\d.]+,?\s*)+\)/g;
      const gpaExtractPattern = /gpa(\d):\s*([\d.]+)/g;
      
      let match;
      while ((match = passedPattern.exec(pageText)) !== null) {
        const roll = match[1];
        const gpaSection = match[0];
        const semesterGpas: Record<string, number> = {};
        
        let gpaMatch;
        gpaExtractPattern.lastIndex = 0;
        while ((gpaMatch = gpaExtractPattern.exec(gpaSection)) !== null) {
          semesterGpas[`gpa${gpaMatch[1]}`] = parseFloat(gpaMatch[2]);
        }

        results.push({
          rollNumber: roll,
          semester,
          gpa: semesterGpas[`gpa${semester}`] || null,
          gpas: semesterGpas,
          status: 'pass',
          instituteName: currentInstituteName,
          instituteCode: currentInstituteCode,
          regulation,
          batch
        });
      }

      // 3. Pattern for Referred Students
      const referredPattern = /(\d{4,10})\s*\{\s*((?:gpa\d:\s*(?:ref|[\d.]+),?\s*)+)ref_sub:\s*([^}]+)\}/g;
      while ((match = referredPattern.exec(pageText)) !== null) {
        const roll = match[1];
        const gpaSection = match[2];
        const refSubsStr = match[3];
        const semesterGpas: Record<string, number | null> = {};
        
        const subGpaPattern = /gpa(\d):\s*(ref|[\d.]+)/g;
        let gpaMatch;
        while ((gpaMatch = subGpaPattern.exec(gpaSection)) !== null) {
          semesterGpas[`gpa${gpaMatch[1]}`] = gpaMatch[2] === 'ref' ? null : parseFloat(gpaMatch[2]);
        }

        const subjects = refSubsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

        results.push({
          rollNumber: roll,
          semester,
          gpa: semesterGpas[`gpa${semester}`] || null,
          gpas: semesterGpas,
          status: 'referred',
          referredSubjects: subjects,
          instituteName: currentInstituteName,
          instituteCode: currentInstituteCode,
          regulation,
          batch
        });
      }

      // 4. Pattern for Failed Students (4+ subjects, no GPAs)
      const failedPattern = /(\d{4,10})\s*\{\s*([^{}]+)\}/g;
      while ((match = failedPattern.exec(pageText)) !== null) {
        const roll = match[1];
        const innerText = match[2];
        
        if (!innerText.includes('gpa')) {
          const subjects = innerText.split(',').map(s => s.trim()).filter(s => s.includes('('));
          if (subjects.length > 0) {
            results.push({
              rollNumber: roll,
              semester,
              gpa: null,
              status: 'fail',
              referredSubjects: subjects,
              instituteName: currentInstituteName,
              instituteCode: currentInstituteCode,
              regulation,
              batch
            });
          }
        }
      }
    }
  
    console.log(`Parsing complete. Found ${results.length} results.`);
    return results;
  } catch (error) {
    console.error("PDF Parsing Error:", error);
    throw error;
  }
}
