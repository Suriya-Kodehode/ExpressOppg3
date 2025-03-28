/*
SQL Oppgave 3 av Suriya, Kristiansund
*/
--use kh;
--alter database Oppg3 set single_user with rollback immediate;
--drop database Oppg3;

create database Oppg3;
go
use Oppg3;
go
 

create table t_Users (
	UserID bigint identity(1,1) primary key not null,
	Username nvarchar(100) null,
	Email nvarchar(100) not  null,
	HPassword varbinary(4000) not null,
	Salt nvarchar(4000) null,
	Active bit not null default 1
);
go


create table t_UsersTokens (
	ID bigint identity(1,1) primary key not null,
	DateCreated datetime not null,
	UserID bigint not null,
	Token varbinary(4000) not null,
	TokenValidDate datetime not null,

	foreign key (UserID) references t_Users(UserID) on delete cascade
);
go

create table t_LogEvents (
	ID bigint identity(1,1) primary key,
	LogTime datetime default getdate() not null,
	LogType nvarchar(100) not null,
	LogText nvarchar(4000) not null,
	UserID bigint null,
	DBUser nvarchar(100) null,

	foreign key (UserID) references t_Users(UserID) on delete cascade
);
go

create procedure sp_SignUp
	@Username nvarchar(100) = null,
	@Password nvarchar(100),
	@Email nvarchar(100)
as
begin
	declare @Salt nvarchar(4000);
	declare @HashedPassword varbinary(4000);
	declare @CurrentUserID bigint;

	if (@Email is null or @Email = '') or (@Password is null or @Password = '')
	begin 
		set @CurrentUserID = -1;
		return @CurrentUserID;
	end;

	begin try
		if exists (select 1 from t_Users where Email = @Email)
		begin
			set @CurrentUserID = -2;
			return @CurrentUserID;
		end

		if (@Username is not null and @Username != '')
		begin
			if exists (select 1 from t_Users where Username = @Username) 
			begin
				set @CurrentUserID = -3;
				return @CurrentUserID;
			end
		end

		set @Salt = replace (newid(), '-', '') + replace (newid(), '-', '') + replace (newid(), '-', '') + replace (newid(), '-', '');
		set @HashedPassword = HASHBYTES('SHA2_512', @Password + @Salt);

		insert into t_Users (Username, HPassword, Salt, Email, Active)
		values (@Username, @HashedPassword, @Salt, @Email, 1);

		set @CurrentUserID = SCOPE_IDENTITY();

		insert into t_LogEvents (LogTime, LogType, LogText, UserID)
		values (getdate(), 'User Signup', 'New user signed up: ' + isnull(@Username, 'N/A'), @CurrentUserID);

		return 0;
	end try
	begin catch
		declare @ErrorMessage nvarchar(4000);
		declare @ErrorSeverity int;
		declare @ErrorState int;

		select
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();

		insert into t_LogEvents (LogTime, LogType, LogText)
		values (getdate(), 'Signup error', 'Error: ' + @ErrorMessage + ', Email: ' + @Email);

		raiserror(@ErrorMessage, @ErrorSeverity, @ErrorState);

		return -4;
	end catch
end
go

create procedure sp_Login 
	@Identifier nvarchar(100), 
	@Password nvarchar(100), 
	@Token varbinary(4000),
	@UserID bigint output,
	@ReturnCode int output
as
begin
	set nocount on;

	begin transaction;

	declare @Salt nvarchar(4000);
	declare @HashedPassword varbinary(4000);
	declare @CurrentTime datetime = getdate();

	begin try
		if @Identifier is null or @Password is null
		begin
			set @ReturnCode = -1;
			return;
		end

		select @Salt = Salt, @UserID = UserID
		from t_Users
		where lower(Username) = lower(@Identifier) or lower(Email) = lower(@Identifier);

		if @Salt is null
		begin
			set @ReturnCode = -1;
			return;
		end

		set @HashedPassword = HASHBYTES('SHA2_512', @Password + @Salt);

		if not exists (select 1 from t_Users 
		where (lower(Username) = lower(@Identifier) or lower(Email) = lower(@Identifier)) 
		and HPassword = @HashedPassword)

		begin
			insert into t_LogEvents (LogTime, LogType, LogText)
			values (getdate(), 'Login Error', 'Invalid passsword for: ' + @Identifier);
			set @ReturnCode = -1;
			return;
		end

		if exists (select 1 from t_UsersTokens where UserID = @UserID)
		begin
			update t_UsersTokens
			set Token = @Token,
				TokenValidDate = dateadd(minute, 30, @CurrentTime),
				DateCreated = @CurrentTime
			where UserID = @UserID;
		end
		else
		begin
			insert into t_UsersTokens (UserID, Token, TokenValidDate, DateCreated)
			values (@UserID, @Token, dateadd(minute, 30, @CurrentTime), @CurrentTime);
		end;

		set @ReturnCode = 0;
		commit transaction;
	end try
	begin catch
		rollback transaction;

		declare @ErrorMessage nvarchar(4000);
		declare @ErrorSeverity int;
		declare @ErrorState int;

		select
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();

		insert into t_LogEvents (LogTime, LogType, LogText)
		values (getdate(), 'Login Error', 'Error: ' + @ErrorMessage + ', Identifier: ' + @Identifier);

		raiserror(@ErrorMessage, @ErrorSeverity, @ErrorState);

		set @ReturnCode = -2;
	end catch
end
go

create procedure sp_EditUser
	@Token varbinary(4000),
	@NewUsername nvarchar(100) = null,
	@NewPassword nvarchar(100) = null,
	@NewEmail nvarchar(100) = null,
	@ReturnCode int output
as
begin
	declare @UserID bigint;
	declare @Salt nvarchar(4000);
	declare @HashedPassword varbinary(4000);
	declare @CurrentTime datetime = getdate();

	begin try
		select @UserID = UserID
		from t_UsersTokens
		where Token = @Token
		and TokenValidDate > @CurrentTime;

		if @UserID is null
		begin
			set @ReturnCode = -1;
			return;
		end

		if @NewEmail is not null and exists (
			select 1 
			from t_Users 
			where Email = @NewEmail 
			and UserID != @UserID)
		begin
			insert into t_LogEvents (LogTime, LogType, LogText)
			values (@CurrentTime, 'Edit Error', 'Email conflict with existing email: ' + @NewEmail)
			set @ReturnCode = -3;
			return;
		end
		if @NewUsername is not null and exists (
			select 1
			from t_Users
			where Username = @NewUsername
			and UserID != @UserID)
		begin
			insert into t_LogEvents (LogTime, LogType, LogText)
			values (@CurrentTime, 'Edit Error', 'Username conflict with existing username: ' + @NewUsername);
			set @ReturnCode = -2;
			return;
		end

		if @NewUsername is not null
		begin	
			update t_Users
			set UserName = @NewUsername
			where UserID = @UserID;
		end

		if @NewPassword is not null
		begin
			set @Salt = replace(newid(), '-', '') + replace(newid(), '-', '') + replace(newid(), '-', '') + replace(newid(), '-', '');
			set @HashedPassword = HASHBYTES('SHA2_512', @NewPassword + @Salt);
			update t_Users
			set HPassword = @HashedPassword, Salt = @Salt
			where UserID = @UserID;
		end

		if @NewEmail is not null
		begin
			update t_Users
			set Email = @NewEmail
			where UserID = @UserID;
		end

		update t_UsersTokens
		set TokenValidDate = dateadd(minute, 30, @CurrentTime)
		where Token = @Token;

		set @ReturnCode = 0;
	end try
	begin catch
		declare @ErrorMessage nvarchar(4000);
		declare @ErrorSeverity int;
		declare @ErrorState int;

		select
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();

		insert into t_LogEvents (LogTime, LogType, LogText, UserID)
		values (@CurrentTime, 'Edit Error', 'Error occurred: ' + @ErrorMessage, coalesce(@UserID, -1));

		set @ReturnCode = -4;
	end catch
end
go

create trigger tr_iu_t_UsersTokens_LogToEvent
on t_UsersTokens
after insert, update
as
begin
	print 'Start tr_iu_t_UsersTokens_LogToEvent'

	begin try
		insert into t_LogEvents (LogTime, LogType, LogText, UserID, DBUser)
		select 
			getdate(),
			'Token',
			'User Token ' +
			case when exists (select * from deleted where deleted.UserID = inserted.UserID)
				then 'Update' else 'Insert' end + '. UserID: ' + cast(inserted.UserID as nvarchar(100)),
			inserted.UserID,
			null
		from inserted;

		update t_Users
		set Active = t.Active
		from t_Users as t
		join inserted on t.UserID = inserted.UserID;

		insert into t_LogEvents (LogTime, UserID, LogType, LogText, DBUser)
		select
			getdate(),
			inserted.UserID,
			'User Active Status',
			case when t.Active = 1 then 'User set as active' else 'User set as inactive' end,
			null
		from inserted
		join t_Users as t on inserted.UserID = t.UserID;
	end try
	begin catch
		insert into t_LogEvents (LogTime, LogType, LogText)
		values (getdate(), 'UserToken Error', ERROR_MESSAGE());

		throw;
	end catch;

	print 'End tr_iu_t_UsersTokens_LogToEvent'
end;
go

create trigger tr_iu_t_Users_LogToEvent
on t_Users
after insert, update
as
begin
	print 'Start tr_iu_t_Users_LogToEvent'

	begin try
		insert into t_LogEvents (LogTime, LogType, LogText, UserID, DBUser)
		select
			getdate(),
			'User',
			'User record ' +
			case when exists (select * from deleted where deleted.UserID = inserted.UserID)
				then 'Update' else 'Insert' end +
			'. Username: ' + inserted.Username +
			', Email: ' + inserted.Email +
			', Active: ' + convert(nvarchar(10), inserted.Active),
			inserted.UserID,
			null
		from inserted;
	end try
	begin catch
		insert into t_LogEvents (LogTime, LogType, LogText)
		values (getdate(), 'User Log Error', ERROR_MESSAGE());

		throw;		
	end catch;

	print 'End tr_iu_t_Users_LogToEvent'
end;
go