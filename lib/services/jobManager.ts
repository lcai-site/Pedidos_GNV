// Sistema de gerenciamento de jobs assíncronos para geração de etiquetas

import type { JobStatus, ResultadoEtiqueta } from '../types/labels';

class JobManager {
    private jobs: Map<string, JobStatus> = new Map();

    /**
     * Cria um novo job
     */
    createJob(produto: 'DP' | 'BF' | 'BL', total: number): string {
        const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const job: JobStatus = {
            id,
            produto,
            status: 'processando',
            total,
            processados: 0,
            sucesso: 0,
            erros: 0,
            detalhes: [],
            created_at: new Date(),
            updated_at: new Date()
        };

        this.jobs.set(id, job);
        return id;
    }

    /**
     * Atualiza progresso do job
     */
    updateProgress(jobId: string, resultado: ResultadoEtiqueta): void {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.processados++;
        if (resultado.status === 'sucesso') {
            job.sucesso++;
        } else {
            job.erros++;
        }
        job.detalhes.push(resultado);
        job.updated_at = new Date();

        this.jobs.set(jobId, job);
    }

    /**
     * Marca job como concluído
     */
    completeJob(jobId: string): void {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'concluido';
        job.updated_at = new Date();
        this.jobs.set(jobId, job);
    }

    /**
     * Marca job como erro
     */
    failJob(jobId: string): void {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'erro';
        job.updated_at = new Date();
        this.jobs.set(jobId, job);
    }

    /**
     * Obtém status do job
     */
    getJob(jobId: string): JobStatus | undefined {
        return this.jobs.get(jobId);
    }

    /**
     * Remove job antigo (limpeza)
     */
    cleanOldJobs(maxAgeHours: number = 24): void {
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000;

        for (const [id, job] of this.jobs.entries()) {
            const age = now - job.created_at.getTime();
            if (age > maxAge) {
                this.jobs.delete(id);
            }
        }
    }
}

// Singleton instance
export const jobManager = new JobManager();
