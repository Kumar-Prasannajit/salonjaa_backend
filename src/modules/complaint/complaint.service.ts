import { ComplaintRepository } from "@/modules/complaint/complaint.repository";
import { ComplaintDTO, FileComplaintInput } from "@/modules/complaint/complaint.types";
import { complaints } from "@/db/schema";

type ComplaintRow = typeof complaints.$inferSelect;

export class ComplaintService {
  constructor(private readonly repo: ComplaintRepository = new ComplaintRepository()) {}

  async file(userId: string, input: FileComplaintInput): Promise<ComplaintDTO> {
    const row = await this.repo.create(userId, input);
    return this.toDTO(row);
  }

  private toDTO(row: ComplaintRow): ComplaintDTO {
    return {
      id: row.id,
      filedByUserId: row.filedByUserId,
      type: row.type,
      referenceId: row.referenceId,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
